#!/bin/bash

curl -s https://creosite.com/UTIL/creo11_allopt.htm |
  grep -vi "hidden" |
  awk '{
    while (match($0, /<A NAME=([^>]+)>/, arr)) {
        names[++count] = arr[1]
        $0 = substr($0, RSTART + RLENGTH)
    }
}
END {
    out = "("
    for(i=1;i<=count;i++){
        out = out ((i>1?"|":"") names[i])
    }
    out = out ")"
    print out > "defaultConfigs.txt"
}'

curl -s https://creosite.com/UTIL/creo11_allopt.htm |
  grep -i "hidden" |
  awk '{
    while (match($0, /<A NAME=([^>]+)>/, arr)) {
        names[++count] = arr[1]
        $0 = substr($0, RSTART + RLENGTH)
    }
}
END {
    out = "("
    for(i=1;i<=count;i++){
        out = out ((i>1?"|":"") names[i])
    }
    out = out ")"
    print out > "hiddenConfigs.txt"
}'
