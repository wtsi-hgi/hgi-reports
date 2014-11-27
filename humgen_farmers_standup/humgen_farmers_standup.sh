#!/bin/bash

# evil hack to get around the fact that to run on the farm it needs to be
# run interactively on a node and there are issues getting the java classpath
# right to load the vertica jar
# so we cd to the directory of the script to mkae this stuff work
cd "$( dirname "${BASH_SOURCE[0]}" )"

# set the environment
export PATH=/software/python-2.7.8/bin:$PATH
export LD_LIBRARY_PATH=/software/python-2.7.8/lib:$LD_LIBRARY_PATH

# debug
echo `which python`

# generate the tex file
python humgen_farmers_standup.py > humgen_farmers_standup.tex

# run latex 3 times to resolve all forward references
pdflatex humgen_farmers_standup
pdflatex humgen_farmers_standup
pdflatex humgen_farmers_standup

# tidy up
rm humgen_farmers_standup.tex
rm humgen_farmers_standup.log
