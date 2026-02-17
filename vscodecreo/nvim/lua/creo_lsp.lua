-- nvim/lua/creo_lsp.lua
-- Neovim LSP configuration for Creo .pro files
-- Usage: require('creo_lsp').setup('/absolute/path/to/repo/server/server.js')

local M = {}

function M.setup(server_path)
  local lspconfig = require('lspconfig')
  
  if not server_path then
    server_path = vim.fn.expand('~') .. '/path/to/repo/server/server.js'
    vim.notify('Warning: using default server path: ' .. server_path, vim.log.levels.WARN)
  end
  
  -- Define custom LSP config for 'pro' language
  local configs = require('lspconfig.configs')
  
  if not configs.creo_lsp then
    configs.creo_lsp = {
      default_config = {
        cmd = { 'node', server_path },
        filetypes = { 'pro' },
        root_dir = lspconfig.util.root_pattern('.git', '.'),
        settings = {},
        name = 'creo_lsp'
      }
    }
  end
  
  lspconfig.creo_lsp.setup({
    on_attach = function(client, bufnr)
      vim.notify('Creo LSP attached to buffer ' .. bufnr, vim.log.levels.INFO)
    end
  })
  
  vim.notify('Creo LSP configured for filetype "pro"', vim.log.levels.INFO)
end

return M

