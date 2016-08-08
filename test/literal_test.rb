class LiteralTest

  STRINGS_ARRAY_w = %w[I think this is correct Strings Array w].freeze

  STRINGS_ARRAY_W = %W[I think this is correct Strings Array W].freeze
    
  SYMBOLS_ARRAY_i = %i[I think this is correct Symbols Array i].freeze

  SYMBOLS_ARRAY_I = %I[I think this is correct Symbols Array I].freeze

  def init
  
    inter = 'interpolation'
  
    strings_array_w = %w[I think this is correct Strings Array w].freeze

    strings_array_W = %W[I think this is correct Strings Array W #{inter}].freeze
      
    symbols_array_i = %i[I think this is correct Symbols Array i].freeze

    symbols_array_I = %I[I think this is correct Symbols Array I #{inter}].freeze

  end


end