We have a MIDI device plugged into this chromebook running Chrome.  When we navigate to this page: 
`https://blog.abletondrummer.com/online-midi-monitor/` we see that after granting MIDI permission to the app there, that playing notes on the MIDI device shows up in the midi detection web app as NOTE ON messages.

We want to figure out how to use open source code from github and the ES6 community to have this functionality in infinite-neck.  The goal is to turn MIDI NOTE ON messages to MIDI clicks in Instrument tables.  We will define rules and UI around that later in this sprint.  For now we just want to get to bright screen with a span registering MIDI NOTE ON.

So we'll need to review our options such as which libraries to use to wire this up, before we can go to coding.  