#!/bin/bash

function create_updated_patch() {
	local file_path="${1}"
	local updated_lines="${2}"

	while read -r line; do
		IFS=':'

		read -r -a lineArray <<<"${line}"

		lineNumber=${lineArray[0]}
		lineContent=${lineArray[1]}

		current_line_string=$(sed "${lineNumber}q;d" "${file_path}")


		if [[ "${current_line_string}" == *"${DESTINATION_PATH_ADDITION}"* ]]; then
			echo "Skipping line ${lineNumber}: Already converted"
		else
			sed -i "${lineNumber}s~^.*$~${lineContent}~" "${file_path}"

			echo "Updating line ${lineNumber}: Success"
		fi
	done <<<"$updated_lines"

	echo "Patch file updated"
}

create_updated_patch "${1}" "${2}"
