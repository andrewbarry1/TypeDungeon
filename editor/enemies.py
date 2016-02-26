#!/usr/bin/python

# script returns <option>'s with enemy names.

import os, cgi

enemies = [fn.split('-')[0] for fn in os.listdir('../assets') if '-' in fn and fn.split('-')[1] == 'enemy.png']

print("Content-Type:text/plain\n")
for e in enemies:
    print('<option>' + e + '</option>')
