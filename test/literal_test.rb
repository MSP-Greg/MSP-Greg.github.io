class LiteralTest

  GEM_DEP_FILES = %w[
    gem.deps.rb
    Gemfile
    Isolate
  ]

  ##
  # Exception classes used in a Gem.read_binary +rescue+ statement. Not all of
  # these are defined in Ruby 1.8.7, hence the need for this convoluted setup.

  READ_BINARY_ERRORS = begin
    read_binary_errors = [Errno::EACCES]
    read_binary_errors << Errno::ENOTSUP if Errno.const_defined?(:ENOTSUP)
    read_binary_errors
  end.freeze

  ##
  # Subdirectories in a gem repository for default gems

  REPOSITORY_DEFAULT_GEM_SUBDIRECTORIES = %w[
    gems
    specifications/default
  ]

  ##
  # Subdirectories in a gem repository

  REPOSITORY_SUBDIRECTORIES = %w[
    build_info
    cache
    doc
    extensions
    gems
    specifications
  ]

  WIN_PATTERNS = [
    /bccwin/i,
    /cygwin/i,
    /djgpp/i,
    /mingw/i,
    /mswin/i,
    /wince/i,
  ]

  ##
  # Exception classes used in Gem.write_binary +rescue+ statement. Not all of
  # these are defined in Ruby 1.8.7.

  WRITE_BINARY_ERRORS = begin
    write_binary_errors = []
    write_binary_errors << Errno::ENOTSUP if Errno.const_defined?(:ENOTSUP)
    write_binary_errors
  end.freeze

  Z_LIT_STRINGS_ARRAY_w = %w[
    I think this is correct
    Strings Array w
  ]

  Z_LIT_STRINGS_ARRAY_W = %W[
    I think this is correct
    Strings Array W
  ].freeze

  Z_LIT_SYMBOLS_ARRAY_i = %i[
    I think this is correct
    Symbols Array i
  ].freeze

  Z_LIT_SYMBOLS_ARRAY_I = %I[
    I think this is correct
    Symbols Array I
  ].freeze

  Z_SYMBOL_ARRAY = [
    :test,
    :this,
    :now,
  ].freeze

  @@strings_array_W_1 = %W[Strings Array
    Strings Array W #{inter}
    ]

  @@strings_array_W_2 = %W[Strings Array W #{inter} ]
  @@strings_array_W_3 = %W[Strings Array W #{inter}]

  @@strings_array_w_1 = %w[Strings Array
      Strings Array w
    ]

  @@strings_array_w_2 = %w[Strings Array w ]
  @@strings_array_w_3 = %w[Strings Array w]

  @@symbols_array_I_1 = %I[
    Symbols Array
    Symbols Array I
  ]

  @@symbols_array_I_2 = %I[ Symbols Array I ]
  @@symbols_array_I_3 = %I[ Symbols Array I]

  @@symbols_array_i_1 = %i[
    Symbols Array
    Symbols Array i
  ]

  @@symbols_array_i_2 = %i[ Symbols Array i ]
  @@symbols_array_i_3 = %i[ Symbols Array i]

  def init
    inter = 'interpolation'

    strings_array_w = %w[ Strings Array w].freeze

    strings_array_W = %W[ Strings Array W #{inter}].freeze

    strings_array_w = %w[ Strings Array
      Strings Array w
    ]

    strings_array_W = %W[ Strings Array
      Strings Array W #{inter}
    ]

    symbols_array_i = %i[ Symbols Array i].freeze

    symbols_array_I = %I[ Symbols Array I #{inter}].freeze

    symbols_array_i = %i[ Symbols Array
      Symbols Array i
    ]

    symbols_array_I = %I[ Symbols Array
      Symbols Array I #{inter}
    ]
  end


end