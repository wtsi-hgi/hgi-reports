#!/bin/bash

set -euf -o pipefail
function errcho {
  >&2 echo $@
}

# get directory containing this script
HFS_DIR=$(dirname $(cd ${0%/*} && echo $PWD/${0##*/}))

# get current date
DATE=`date +%Y_%m_%d`

# make a virtualenv and install prerequisites
if [[ ! -d "${HFS_DIR}/venv" ]]; then
    /software/hgi/pkglocal/virtualenv-12.0.5-python-2.7.8-ucs4/bin-wrap/virtualenv ${HFS_DIR}/venv
fi
set +u # virtualenv's bin/activate references unbound variables
. ${HFS_DIR}/venv/bin/activate
set -u
pip install -q -r ${HFS_DIR}/requirements.txt 

# make sure required environment variables are set
have_all_required=1
if [[ ${VERTICA_USERNAME+1} != 1 ]]; then
    errcho "please set VERTICA_USERNAME"
    have_all_required=0
fi
if [[ ${VERTICA_PASSWORD+1} != 1 ]]; then
    errcho "please set VERTICA_PASSWORD"
    have_all_required=0
fi
if [[ ${VERTICA_JDBC_URL+1} != 1 ]]; then
    errcho "please set VERTICA_JDBC_URL"
    have_all_required=0
fi
if [[ ${VERTICA_CLASSPATH+1} != 1 ]]; then
    errcho "please set VERTICA_CLASSPATH"
    have_all_required=0
fi
if [[ ${LDAP_URL+1} != 1 ]]; then
    errcho "please set LDAP_URL"
    have_all_required=0
fi
if [[ ${LDAP_USER_BASE_DN+1} != 1 ]]; then
    errcho "please set LDAP_USER_BASE_DN"
    have_all_required=0
fi

if [[ ${have_all_required} != 1 ]]; then
    errcho "cannot continue without required variables set"
    exit 1
fi

# ensure output directories exist
mkdir -p ${HFS_DIR}/reports
mkdir -p ${HFS_DIR}/reports/portraits
cd ${HFS_DIR}/reports

# generate the tex file 
OUTFILE_BASE=${HFS_DIR}/reports/humgen-standup-${DATE}
echo "generating ${OUTFILE_BASE}.tex"
python ${HFS_DIR}/humgen_farmers_standup.py -u ${VERTICA_USERNAME} --password ${VERTICA_PASSWORD} --jdbc-url ${VERTICA_JDBC_URL} --jdbc-classpath ${VERTICA_CLASSPATH} --ldap-url ${LDAP_URL} --ldap-user-base-dn ${LDAP_USER_BASE_DN} --portrait-path ./portraits --blank-portrait-path ./portraits/blank.jpg --output ${OUTFILE_BASE}.tex

# deactivate virtualenv
set +u # virtualenv's deactivate references unbound variables
deactivate
set -u

# run latex 3 times to resolve all forward references
pdflatex ${OUTFILE_BASE}.tex
pdflatex ${OUTFILE_BASE}.tex
pdflatex ${OUTFILE_BASE}.tex

# tidy up
rm ${OUTFILE_BASE}.log
rm ${OUTFILE_BASE}.aux

