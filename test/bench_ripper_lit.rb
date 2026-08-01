verbose = $VERBOSE
$VERBOSE = nil

require 'benchmark'
require_relative '../lib/yard'
require_relative '../lib/yard/parser/ruby/ruby_parser'

root = File.join(File.dirname(__FILE__), '..')
#file = File.expand_path('lib/yard/parser/ruby/legacy/ruby_lex.rb', root)
#file = File.expand_path('lib/yard/code_objects/base.rb', root)
file = File.expand_path('lib/yard/parser/ruby/ruby_parser.rb', root)
src  = File.read(file)

TIMES = (ARGV[0] || 100).to_i

class RipperLitFix < YARD::Parser::Ruby::RipperParser
  @percent_ary = nil
  def add_token(token, data)
    if @percent_ary
      if token == :words_sep && data !~ /\s\z/
        rng = @percent_ary.source_range
        rng = Range.new(rng.first, rng.last + data.length)
        @percent_ary.source_range = rng
        @tokens << [token, data, [lineno, charno]]
        @percent_ary = nil
      elsif token == :tstring_end && data =~ /\A\s/
        rng = @percent_ary.source_range
        rng = Range.new(rng.first, rng.last + data.length)
        @percent_ary.source_range = rng
        @tokens << [token, data, [lineno, charno]]
        @percent_ary = nil
      end
    elsif @tokens.last && @tokens.last[0] == :symbeg
      @tokens[-1] = [:symbol, ":" + data, @tokens.last[2]]
    elsif @heredoc_state == :started
      @heredoc_tokens << [token, data, [lineno, charno]]

      # fix ripper encoding of heredoc bug
      # (see http://bugs.ruby-lang.org/issues/6200)
      data.force_encoding(file_encoding) if file_encoding

      @heredoc_state = :ended if token == :heredoc_end
    elsif (token == :nl || token == :comment) && @heredoc_state == :ended
      @heredoc_tokens.unshift([token, data, [lineno, charno]])
      @tokens += @heredoc_tokens
      @heredoc_tokens = nil
      @heredoc_state = nil
    else
      @tokens << [token, data, [lineno, charno]]
      if token == :heredoc_beg
        @heredoc_state = :started
        @heredoc_tokens = []
      end
    end
  end

  %w(symbols qsymbols words qwords).each do |kw|
    module_eval(<<-eof, __FILE__, __LINE__ + 1)
      begin; undef on_#{kw}_new; rescue NameError; end
      def on_#{kw}_new(*args)
        node = YARD::Parser::Ruby::LiteralNode.new(:#{kw}_literal, args)
        @percent_ary = node
        if @map[:#{kw}_beg]
          lstart, sstart = *@map[:#{kw}_beg].pop
          node.source_range = Range.new(sstart, @ns_charno-1)
          node.line_range = Range.new(lstart, lineno)
        end
        node
      end

      begin; undef on_#{kw}_add; rescue NameError; end
      def on_#{kw}_add(list, item)
        last = @source[@ns_charno,1] == "\n" ? @ns_charno - 1 : @ns_charno
        list.source_range = (list.source_range.first..last)
        list.line_range = (list.line_range.first..lineno)
        list.push(item)
        list
      end
    eof
  end
end

puts

Benchmark.bmbm do |b|
  b.report("original") { TIMES.times { YARD::Parser::Ruby::RipperParser.new(src, file).parse } }
  b.report("lit_fix")  { TIMES.times { RipperLitFix.new(src, file).parse } }
end

puts

delimiter_a = [
  [ '(', ')'],
  [ '{', '}'],
  [ '[', ']'],
  [ '<', '>'],
  [ '|', '|']
]

type_a = [
  ['i', :qsymbols_literal ],
  ['I', :symbols_literal  ],
  ['w', :qwords_literal   ],
  ['W', :words_literal    ]
]

str_a = [
  'TEST = %{type}[A B C]'     ,
  'TEST = %{type}[  A  B  C  ]'   ,
  'TEST = %{type}[ \nA \nB \nC \n]'  ,
  'TEST = %{type}[\n\nAD\n\nB\n\nC\n\n]' ,
  'TEST = %{type}[\n A\n B\n C\n ]'
]


# below tests the two parsers (original & patched) for correct parsing
# of all four types of percent literal arrays

[ YARD::Parser::Ruby::RipperParser, RipperLitFix].each do |base_parser|

  Base_Parser = base_parser

  class YARD::Parser::Ruby::RubyParser
    def initialize(source, filename)
      @parser = Base_Parser.new(source, filename)
    end
  end

  parser = YARD::Parser::Ruby::RubyParser

  puts "\nUsing #{(base_parser.to_s + ' ').ljust(45, '-')}"

  failed_tests = ''

  delimiter_a.each do |dl|
    type_a.each do |ta|
      str_a.each do |str|
        str_sub = str.sub(/\{type\}/, ta[0])
        str_sub.sub!(/\[/, dl[0])
        str_sub.sub!(/\]/, dl[1])

        str_i = str_sub.gsub(/\\n/, "\n")

        str_sub = str_sub[7..-1]

        s = parser.parse(str_i, 't').ast

        node = s.jump(ta[1])
        if node.source.gsub(/\n/, '\\n') != str_sub
          failed_tests << "#{str_sub}\n"
        end
      end
    end
  end

  if failed_tests.empty?
    puts "All tests passed"
  else
    puts "The following tests failed"
    puts failed_tests
  end

end

$VERBOSE = verbose
