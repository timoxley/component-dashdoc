DOCSETUTIL=/Applications/Xcode.app/Contents/Developer/usr/bin/docsetutil

build:
	bin/component-dashdoc && $(DOCSETUTIL) index build/Components.docset

release: clean build
	mv build release
	zip -r release/Components.docset.zip release/Components.docset

clean:
	rm -fr release build

.PHONY: clean build
