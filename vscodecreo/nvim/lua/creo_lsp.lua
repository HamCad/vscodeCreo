-- nvim/lua/mylang_lsp.lua
-- Example configuration for nvim-lspconfig. Put this file in ~/.config/nvim/lua/ and require it from init.lua:
-- require('mylang_lsp').setup('/absolute/path/to/repo/server/server.js')
local M = {}

function M.setup(server_path)
  local lspconfig = require('lspconfig')
  if not server_path then
    server_path = '/path/to/repo/server/server.js' -- change or pass explicitly
  end
  lspconfig.mylang = {
    default_config = {
      cmd = { 'node', server_path },
      filetypes = { 'mylang' },
      root_dir = lspconfig.util.root_pattern('.git', '.'),
      settings = {}
    }
  }
  lspconfig.mylang.setup({})
end

return M

