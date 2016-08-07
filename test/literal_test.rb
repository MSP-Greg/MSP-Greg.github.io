class LiteralTest

  STRINGS_ARRAY_w = %w[I think this is correct Strings Array w]

  STRINGS_ARRAY_W = %W[I think this is correct Strings Array W]
    
  SYMBOLS_ARRAY_i = %i[I think this is correct Symbols Array i]

  SYMBOLS_ARRAY_I = %I[I think this is correct Symbols Array I]

  def init
  
    inter = 'interpolation'
  
    strings_array_w = %w[I think this is correct Strings Array w]

    strings_array_W = %W[I think this is correct Strings Array W #{inter}]
      
    symbols_array_i = %i[I think this is correct Symbols Array i]

    symbols_array_I = %I[I think this is correct Symbols Array I #{inter}]

  end


end