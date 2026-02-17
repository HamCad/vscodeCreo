; TreeSitter highlighting for .pro files
; This is a stub - actual TreeSitter parser would need to be built

; Comments
((comment) @comment)

; Keywords
((identifier) @keyword (#eq? @keyword "mapkey"))

; Directives
((directive) @keyword.directive)

; Strings
((string) @string)
