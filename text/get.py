#!/usr/bin/python

# TypeDungeon by Andrew Barry
# script for feeding text to type to the game client

import cgi, cgitb
import textwrap
import random
import time

cgitb.enable()

text_files = ['frankenstein.txt', 'alice.txt', 'ulysses.txt', 'modest.txt', 'traps.txt', 'wood.txt', 'scarlet.txt', 'spacedoor.txt', 'bulgaria.txt']

form = cgi.FieldStorage()

random.seed(int(time.time()))

def get_processed_text(src_file, l, n):
    file = open(src_file,'r')
    words = file.read().replace("\n"," ").replace("  "," ")
    file.close()
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
    return final_wrapped


l= int(form.getvalue("l"))
n = [int(form.getvalue("n")) if "n" in form else 0][0]
src_file = [form.getvalue("src") if "src" in form else random.choice(text_files)][0]
text_files.remove(src_file)
final_wrapped = get_processed_text(src_file, l, n)

if (n + 10 >= len(final_wrapped)): # end of source reached, prepare new one
    src_file = random.choice(text_files)
    final_wrapped += get_processed_text(src_file, l, n)

print("Content-Type:text/plain\n")
print(src_file)
for x in range(n,min(len(final_wrapped),n+10)):
    print(final_wrapped[x])
