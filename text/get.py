#!/usr/bin/python

# TypeDungeon by Andrew Barry
# script for feeding text to type to the game client

import cgi, cgitb
import textwrap
import random
import time

cgitb.enable()

text_files = ['frankenstein.txt', 'alice.txt', 'ulysses.txt', 'modest.txt', 'traps.txt', 'wood.txt', 'scarlet.txt', 'spacedoor.txt']

form = cgi.FieldStorage()

random.seed(int(time.time()))
src_file = [form.getvalue("src") if "src" in form else random.choice(text_files)][0]

file = open(src_file,'r')
words = file.read().replace("\n"," ").replace("  "," ")
file.close()

l= int(form.getvalue("l"))
n = [int(form.getvalue("n")) if "n" in form else 0][0]

wrapper = textwrap.TextWrapper(break_on_hyphens=False, width=l)
wrapped = wrapper.wrap(words)
final_wrapped = []
a = -1
for line in wrapped:
    line += " "
    a += 1
    z = 0
    fin_line = ""
    for ch in line:
        fin_line += "<span id='" + str(a) + "c" + str(z) + "'>" + ch + "</span>"
        z += 1
    final_wrapped.append(fin_line)

print("Content-Type:text/plain\n")
print(src_file)
for x in range(n,min(len(final_wrapped),n+10)):
    print(final_wrapped[x])
