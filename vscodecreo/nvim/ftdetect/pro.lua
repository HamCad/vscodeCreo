-- Filetype detection for .pro files
vim.filetype.add({
  extension = {
    pro = 'pro',
    sup = 'pro',
  },
  filename = {
    ['mapkeys.pro'] = 'pro',
    ['config.pro'] = 'pro',
  },
})
