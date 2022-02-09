#!/usr/bin/awk -f

# TODO: Look into making this more robust by iterating through $0 instead of concating every field manually

# Insert portal path inbetween a|b and remainder of path
function insert_portal_path(path) {
	if (match(path, /^(a|b)\/.*/)) {
		before = substr(path, 0, 2)
		after = substr(path, 3)

		return before portal_path_addition after
	} else {
		return portal_path_addition path
	}
}

# Find beginning of diff block and update a|b paths with additional path for liferay-portal-ee
/^diff --git a\/.* b\/.*$/ {
  aPath = insert_portal_path($3)
  bPath = insert_portal_path($4)

  print NR":" $1 " " $2 " " aPath " " bPath
}

# Finds file subtraction diffs and update the path of that line and the next line if the next line is a file addition diff
/^--- (a\/.*)|(\/dev\/null)$/ {
	if (match($0, /^--- a\/.*/)) {
    print NR ":" $1 " " insert_portal_path($2)
	}

  getline

  # Insert PORTAL_ROUTE_ADDITION inbetween
	if (match($0, /^+++ b\/.*/)) {
    print NR ":" $1 " " insert_portal_path($2)
	}
}

/^(( delete mode)|( create mode) [0-9]* .*$)|( ?rename .*)$/ {
	if (match($0, /^(( delete mode)|( create mode) [0-9]* .*$)/)) {
    print NR ": " $1 " " $2 " " $3 " " insert_portal_path($4)
	} else if (match($0, /^ ?rename .*/)) {
		if (match($0, /^rename (to|from) .*/)) {
			print NR ":" $1 " " $2 " " insert_portal_path($3)
		} else {
			print NR ": " $1 " " insert_portal_path($2) " " $3 " " $4 " " $5
		}
	}
}
