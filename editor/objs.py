#!/usr/bin/python

# script returns <options>'s with wall names

import os, cgi, cgitb

cgitb.enable()

filenames = os.listdir('../assets/models')
taken = []
allowed = 'abcdefghijklmnopqrstuvwxyz0123456789,./;\'[]<>?:\"{}'
print("Content-Type:text/plain\n")
for file in filenames:
    if not(file.endswith(".obj")): continue
    obj_name = file.replace(".obj","")
    token = None
    for c in obj_name:
        if c not in taken:
            token = c
            break
    if token is None:
        for c in allowed:
            if c not in taken:
                token = c
                break
    if token is None:
        break
    taken.append(token)
    print("<option id='o," + token + "'>" + obj_name + " (" + token + ")</option>")
