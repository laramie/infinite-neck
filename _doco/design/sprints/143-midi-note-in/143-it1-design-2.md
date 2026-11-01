# Request

Having read 143-it1-plan.md, here are our choices for the next step.

- Approve prototype in `143-it1-midi-prototype.html`
- Let the prototype have one section for MIDI IN, and another for MIDI OUT.
- MIDI OUT would be three check
- MIDI device is "Focusrite A.E. Ltd Launchpad Pro Standalone Port" chosen as output on channel 1 and input on channel 1. 
- MIDI output on channel 1 on this device to "Focusrite A.E. Ltd Launchpad Pro Standalone Port" with [90 3c 01] lights up the controller at the sent MIDI NOTE ON.  When velocity is zero (00) it clears the lit note.
```
798.263 receive [90 30 00] Launchpad Pro Standalone Port
805.371 send    [90 3C 01] Launchpad Pro Standalone Port
810.514 send    [90 3C 00] Launchpad Pro Standalone Port
```
- Therefore, we would like to test input and output on this iteration.

- Approve using "Option A (native Web MIDI API, no new dependency)"

- Any new code should be centered around `midi-io.js` as soon as a module is needed, in the main folder of the repository.  It seems reasonable to start there and have the tester html page `143-it1-midi-prototype.html` in the sprint folder call that module, since it is new and can't break anything else. 

Something like this would provide enough for MIDI OUT with NOTE ON:
```

<div class="voice-msg-grid">

                        <div class="grid-col-span-2">channel</div>
                        <div>data 1</div>
                        <div>data 2</div>
                        <div class="grid-col-span-2"></div>

                        <div class="msg-name">
                            Note Off
                        </div>
                        <div>
                            <select class="data data-ch" id="NOTE_OFF-ch">
                                <option value="0">1</option>
                                <option value="1">2</option>
                                <option value="2">3</option>
                                <option value="3">4</option>
                                <option value="4">5</option>
                                <option value="5">6</option>
                                <option value="6">7</option>
                                <option value="7">8</option>
                                <option value="8">9</option>
                                <option value="9">10</option>
                                <option value="10">11</option>
                                <option value="11">12</option>
                                <option value="12">13</option>
                                <option value="13">14</option>
                                <option value="14">15</option>
                                <option value="15">16</option>
                            </select>
                        </div>
                        <div>
                            note <input type="text" class="data data1" id="NOTE_OFF-data1" value="0">
                        </div>
                        <div>
                            velocity <input type="text" class="data data2" id="NOTE_OFF-data2" value="0">
                        </div>
                        <div>
                            <button title="Send a Note OFF message" class="btSend" data-msg-mode="CHANNEL_MESSAGE" data-msg-type="NOTE_OFF">Send</button>
                        </div>
                        <div></div>

                        <div class="msg-name">
                            Note On
                        </div>
                        <div>
                            <select class="data data-ch" id="NOTE_ON-ch">
                                <option value="0">1</option>
                                <option value="1">2</option>
                                <option value="2">3</option>
                                <option value="3">4</option>
                                <option value="4">5</option>
                                <option value="5">6</option>
                                <option value="6">7</option>
                                <option value="7">8</option>
                                <option value="8">9</option>
                                <option value="9">10</option>
                                <option value="10">11</option>
                                <option value="11">12</option>
                                <option value="12">13</option>
                                <option value="13">14</option>
                                <option value="14">15</option>
                                <option value="15">16</option>
                            </select>
                        </div>
                        <div>
                            note <input type="text" class="data data1" id="NOTE_ON-data1" value="0">
                        </div>
                        <div>
                            velocity <input type="text" class="data data2" id="NOTE_ON-data2" value="127">
                        </div>
                        <div>
                            <button title="Send a Note ON message" class="btSend" data-msg-mode="CHANNEL_MESSAGE" data-msg-type="NOTE_ON">Send</button>
                        </div>
                        <div></div>

                    </div>
```
