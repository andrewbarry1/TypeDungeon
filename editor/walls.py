#!/usr/bin/python

# script returns <option>'s with wall names.

import os, cgi

filenames = os.listdir('../assets')
taken = []
allowed = 'abcdefghijklmnopqrstuvwxyz01234567890,./;\'[]<>?:\"{}'
print("Content-Type:text/plain\n")
print("<option>SELECT WALL</option>")
for file in filenames:
    if file.endswith('-wall.png'):
        token = None
        for x in range(0,len(file.replace('-wall.png',''))):
            if not(file[x] in taken):
                token = file[x]
                break
        if token is None:
            for x in range(len(allowed)):
                if allowed[x] not in taken:
                    token = allowed[x]
                    break
        if token is None:
            break # all allowed characters taken
        taken.append(token)
        print('<option id=' + token + '>' + file.replace('-wall.png','') + ' (' + token + ')</option>')
