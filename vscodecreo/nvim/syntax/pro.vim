" Vim syntax file
" Language: Creo Pro
" Filetype: pro

if exists("b:current_syntax")
  finish
endif

" Comments
syn match proComment "#.*$"

" Keywords
syn keyword proKeyword mapkey

" Directives
syn match proDirective "@[A-Za-z0-9_\-():]\+"

" Strings
syn region proString start=+"+ skip=+\\\\\|\\"+ end=+"+ 
syn region proString start=+'+ skip=+\\\\\|\\'+ end=+'+ 

" Commands
syn match proTilde "\~"
syn match proSemicolon ";"

" Identifiers
syn match proIdentifier "[A-Za-z0-9_\-+]\+\(:[A-Za-z0-9_\-]\+\)\?"

" Highlight groups
hi def link proComment Comment
hi def link proKeyword Keyword
hi def link proDirective PreProc
hi def link proString String
hi def link proTilde Special
hi def link proSemicolon Delimiter
hi def link proIdentifier Function

let b:current_syntax = "pro"
