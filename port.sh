#!/bin/bash

###########################################################
# Ports the Chrome extension to become Firefox compatible.#
###########################################################

TIMESTAMP=$(date +'%d_%m_%Y_%H-%M-%N')
OUTPUT="ff_port-$TIMESTAMP"

declare -a REQUIRES=(
    '48.png'
    '128.png'
    'main.css'
    'main.js'
    'service.js'
)

declare -a HAYSTACK=(
    'chrome.runtime'
    'chrome.downloads'
    'chrome.tabs'
)

declare -a REPLACE=(
    'browser.runtime'
    'browser.downloads'
)

mkdir "$OUTPUT"

cp "./.ff_requires/manifest.json" "./$OUTPUT/manifest.json"

for FILE in "${REQUIRES[@]}"
do
    cp "./$FILE" "./$OUTPUT/$FILE"

    if [[ $FILE == *".js"  ||  $FILE == *".html" ]]
    then
        echo "Processing: $FILE"
        INDEX=0

        for SEARCH in "${HAYSTACK[@]}"
        do
            while IFS= read -r LINE || [ -n "$LINE" ]
            do
                echo "${LINE//$SEARCH/${REPLACE[INDEX]}}"
            done < "./$OUTPUT/$FILE" > "./$OUTPUT/temp_$FILE"

            rm "./$OUTPUT/$FILE"
            mv "./$OUTPUT/temp_$FILE" "./$OUTPUT/$FILE"

            ((INDEX=INDEX+1))
        done
    fi
done