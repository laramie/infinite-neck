pushd ~/infinite-neck/
npx documentation build  \
infinite-neck.js \
autocolor.js \
colorFunctions.js \
event-bus.js \
NoteTableController.js \
TableBuilder.js \
Song.js \
SongPersistence.js \
Section.js \
SectionNotes.js \
version.js \
tagonomy/tagonomy.js \
tagonomy/Page.js \
tagonomy/WidgetLoader.js \
tagonomy/widgets/org.dynamide.Widget.js \
tagonomy/widgets/org.dynamide.gallery.widget.js \
tagonomy/widgets/partial/partial.js \
tagonomy/widgets/include/include.js \
-f html -o _doco/documentation 

npx documentation build  \
tagonomy/tagonomy.js \
tagonomy/Page.js \
tagonomy/WidgetLoader.js \
tagonomy/widgets/org.dynamide.Widget.js \
tagonomy/widgets/org.dynamide.gallery.widget.js \
tagonomy/widgets/partial/partial.js \
tagonomy/widgets/include/include.js \
-f md -o API.md  
popd
