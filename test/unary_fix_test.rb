# frozen_string_literal: true

# cd /repros/test
# cd /GitHub/yard/benchmarks
# ruby unary_fix_test.rb

require 'yard'
require 'pp'
require 'rspec'
require 'ripper'
require 'benchmark'

module YARD ; module Parser ; module Ruby

  class RipperParser < Ripper

    def t2_on_params(*args)
      args.map! do |arg|
        next arg unless arg.class == Array
        if arg.first.class == Array
          arg.map! do |sub_arg|
            next sub_arg unless sub_arg.class == Array
            type = sub_arg[0].type == :label ? 
              :named_arg : :unnamed_optional_arg
            if Array === (p_node = sub_arg.last) &&
              Array === (opt_node = sub_arg.last.last)
              p_range = p_node.source_range
              opt_range = opt_node.source_range
              if opt_range.last != p_range.last && ![:list, :string_content].include?(opt_node.type)
                sub_arg.last.source_range = (p_range.first..opt_range.last)
              end
            end
            AstNode.new(type, sub_arg, :listline => lineno..lineno, :listchar => charno..charno)
          end
        end
        AstNode.new(:list, arg, :listline => lineno..lineno, :listchar => charno..charno)
      end
      ParameterNode.new(:params, args, :listline => lineno..lineno, :listchar => charno..charno)
    end
  end

  class AstNode < Array
    
    # Similar to traverse, but filters by {#type} matching node_type parameter
    # @param node_type [Symbol] the filter type
    def traverse_by(node_type)
      nodes = self.select {|n| YARD::Parser::Ruby::AstNode === n}
      nodes.each do |node|
        yield node if node.type == node_type
        node.each { |n| nodes << n if YARD::Parser::Ruby::AstNode === n }
      end
      nodes.last
    end
  end

end ; end ; end

module UnaryFix

Base = YARD::Parser::Ruby
Core = RSpec::Core
RParser = Base::RipperParser
 RParser.send(:alias_method, :on_params_orig, :on_params)
 RParser.send(:alias_method, :on_params, :t2_on_params)

  class << self

    def bench
      require 'net/http'
      file = Net::HTTP.method(:proxy_port).source_location[0]
      const_set(:Net, nil)

      src  = File.read(file) 
      times = 50
      orig_file = ''
      fix_file = ''
      ripper = RParser
      
      orig_meth_orig = nil
      orig_meth_t2   = nil
      fix_meth_orig  = nil
      fix_meth_t2    = nil

      puts
      puts "Benchmark - Current vs Unary Fix ----------------------"
      puts "  Parse Ruby Std-Lib lib/net/http.rb"
      puts      

      Benchmark.bmbm do |b|
        RParser.send(:alias_method, :on_params, :on_params_orig)

        b.report("Current")   { times.times { RParser.new(src, file).parse } }

        # below just to check methods
        t = RParser.new(src, file)
        orig_meth_orig = (t.method(:on_params) == t.method(:on_params_orig)) ? '==' : '!='
        orig_meth_t2   = (t.method(:on_params) == t.method(:t2_on_params))   ? '==' : '!='
        t = nil

        RParser.send(:alias_method, :on_params, :t2_on_params)

        fix_file = RParser.new(src, file).method(:on_params).source_location[0]

        b.report("Unary Fix")  { times.times { RParser.new(src, file).parse } }

        # below just to check methods
        t = RParser.new(src, file)
        fix_meth_t2   = (t.method(:on_params) == t.method(:t2_on_params))   ? '==' : '!='
        fix_meth_orig = (t.method(:on_params) == t.method(:on_params_orig)) ? '==' : '!='
        t = nil
      end
      puts
      puts "Method Check ------------------------------------------"
      puts "Current   on_params #{orig_meth_orig} on_params_orig    on_params #{orig_meth_t2} t2_on_params"
      puts "Unary Fix on_params #{ fix_meth_orig} on_params_orig    on_params #{ fix_meth_t2} t2_on_params"
      puts
    end
    
    def rspec_reload
      Core::ExampleGroup.describe "YARD::Parser::Ruby::RipperParser" do

        src = []

        src << ["unary operators with no block parameter",
          [['a', '-1.0'], ['b', '-1'], ['c', '-test']],
          <<-eof
          class Unary
            def minus(a = -1.0, b = -1, c = -test)
            end
          end
          eof
        ]

        src << ["unary operators with a block parameter",
          [['a', '-1.0'], ['b', '-1'], ['&blk', nil]],
          <<-eof
          class Unary
            def minus(a = -1.0, b = -1, &blk)
            end
          end
          eof
        ]

        src << ["all parameter types",
          [['a', nil], ['b', '-1.0'], ['*splat', nil], ['c', nil], ['d:', nil],
          ['e:', '-1'], ['**dsplat', nil], ['&blk', nil]],
          <<-eof
          class ABunch
            def mess(a, b = -1.0, *splat, c, d:, e: -1, **dsplat, &blk)
            end
          end
          eof
        ]

        describe "#parameters" do

          src.each do |s|
        
            describe "#{s[2][/def.+?\)/]} - #{s[0]}" do
            
              def_node = RParser.parse(s[2], 't').ast.jump(:def)
              params = def_node.parameters
              it "generates correct parameters source for MethodObject#signature" do
                expect(params.source).to eq("#{s[2][/\(([^\)]+)/,1]}")
              end
              
#              it "YARD::Handlers::Ruby::MethodHandler#format_args generates a " \
#                "correct parameter array for tags" do
              it "generates a correct array for MethodObject#parameters" do
                hndlr = YARD::Handlers::Ruby::MethodHandler.new(RParser, def_node)
                args = hndlr.format_args                
                expect(args).to eq(s[1])
              end
              
            end
          end
        end
      end
    end

    def run_rspec
      puts "================================= RSpec - YARD Current ==================================="

      RParser.send(:alias_method, :on_params, :on_params_orig)
      UnaryFix.rspec_reload
      RSpec::Core::Runner.run(['-c', '-f', 'd'])

      puts"\n\n"
      puts "================================= RSpec - YARD Unary Fix ================================="

      RParser.send(:alias_method, :on_params, :t2_on_params)      
      RSpec.reset
      UnaryFix.rspec_reload
      RSpec::Core::Runner.run(['-c', '-f', 'd'])
    end
  end
  
end

UnaryFix.bench
UnaryFix.run_rspec

