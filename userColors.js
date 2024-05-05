var gUserColorDict = {
    readOnly: true,
    computed: true,
    checked: true,
    dict: {}
}
var gUserColorDictRolesDefault = {
    readOnly: true,
    computed: false,
    checked: true,
    dict: {
        "noteTransparent":{
            /*   The first radio button gets checked when building the form--let it be this one. */
            "colorClass": "noteTransparent",
            "caption": "Emboss",
            "readonly": true
        },
        "noteAutomatic":{
            "colorClass": "noteAutomatic",
            "caption": "Auto",
            "readonly": true
        },
        "noteScale":{
            "colorClass": "noteBlue2",
            "caption": "Scale",
            "tiny": "Sc"
        },
        "noteRoot": {
            "colorClass": "noteBassPlayer",
            "captionClass": "noteBassPlayer",
            "caption": "Root",
            "tiny": "R"
        },
        "noteChord": {
             "colorClass": "noteRed4",
             "caption": "Chord",
             "tiny": "Ch"
        },
        "noteChord2": {
              "colorClass": "noteRed2",
              "caption": "Ch2",
              "tiny": "Ch"
        },
        "noteChord3": {
               "colorClass": "noteBrown7",
               "caption": "Ch3",
               "tiny": "Ch"
        },
        "noteColornote":{
            "colorClass": "notePink1",
            "caption": "Colornote",
            "tiny": "C1"
        },
        "noteColornote2":{
            "colorClass": "notePink2",
            "caption": "C2",
            "tiny": "C2"
        },
        "noteColornote3":{
            "colorClass": "notePink3",
            "caption": "C3",
            "tiny": "C3"
        },
        "noteChromatic":{
            "colorClass": "noteYellow6",
            "caption": "Chromatic",
            "tiny": "c"
        },
        "notePassing":{
            "colorClass": "noteBlue4",
            "caption": "Passing",
            "tiny": "p"
        },
        "noteAvoid":{
            "colorClass": "noteBlackout1",
            "captionClass": "noteBlackout1Caption",
            "caption": "Avoid",
            "tiny": "a1"
        },
        "noteAvoid2":{
            "colorClass": "noteBlackout2",
            "captionClass": "noteBlackout2Caption",
            "caption": "Avoid",
            "tiny": "a2"
        },
        "noteAvoid3":{
            "colorClass": "noteBlack noteHatched2",
            "caption": "Avoid",
            "tiny": "a3"
        },
        "noteBass":{
            "colorClass": "noteBassPlayer",
            "captionClass": "noteBassPlayer",
            "caption": "Bass",
            "tiny": "B"
        },
        "noteLead":{
            "colorClass": "notePink3",
            "caption": "Lead",
            "tiny": "L"
        },
        "noteLead2":{
            "colorClass": "notePink6",
            "caption": "Lead 2",
            "tiny": "L2"
        }
    }
};
var gUserColorDictFingeringsDefault = {
    readOnly: true,
    computed: false,
    checked: true,
    dict: {
        "noteFinger1":{
            "colorClass": "Finger1",
            "caption": "Finger1",
            "tiny": "F1"

        },
        "noteFinger2":{
            "colorClass": "Finger2",
            "caption": "F2",
            "tiny": "F2"
        },
        "noteFinger3":{
            "colorClass": "Finger3",
            "caption": "F3",
            "tiny": "F3"
        },
        "noteFinger4":{
            "colorClass": "Finger4",
            "caption": "F4",
            "tiny": "F4"
        },
        "noteFingerT":{
            "colorClass": "FingerT",
            "caption": "Thumb",
            "tiny": "T"
        }
    }
};

var gDefault_CycleOfColors = {
    readOnly: true,
    computed: false,
    checked: true,
    dict: {
        "note0": {
            "colorClass": "noteBassPlayer",
            "captionClass": "noteBassPlayer",
            "caption": "I"
        },
        "note1": {
            "colorClass": "notePink1",
            "caption": "&tau;"
        },
        "note2": {
            "colorClass": "notePink2",
            "caption": "II"
        },
        "note3": {
            "colorClass": "noteBlue1",
            "caption": "m"
        },
        "note4": {
            "colorClass": "noteGreen3",
            "caption": "III"
        },
        "note5": {
            "colorClass": "noteBrown1",
            "caption": "IV"
        },
        "note6": {
            "colorClass": "noteBrown3",
            "caption": "&Theta;"
        },
        "note7": {
            "colorClass": "noteRed2",
            "caption": "V"
        },
        "note8": {
            "colorClass": "noteGreen5",
            "caption": "&sigma;"
        },
        "note9": {
            "colorClass": "noteGreen7",
            "caption": "6"
        },
        "note10": {
            "colorClass": "noteBlue4",
            "caption": "&delta;"
        },
        "note11": {
            "colorClass": "notePink5",
            "caption": "&Delta;"
        }
    }
};

var gAllClear = {
    readOnly: true,
    computed: false,
    checked: true,
    dict: {
        "note0": {
          "caption": "I",
          "colorClass": "noteWhite"
        },
        "note1": {
          "caption": "&tau;",
          "colorClass": "noteWhite"
        },
        "note2": {
          "caption": "II",
          "colorClass": "noteWhite"
        },
        "note3": {
          "caption": "m",
          "colorClass": "noteWhite"
        },
        "note4": {
          "caption": "III",
          "colorClass": "noteWhite"
        },
        "note5": {
          "caption": "IV",
          "colorClass": "noteWhite"
        },
        "note6": {
          "caption": "&Theta;",
          "colorClass": "noteWhite"
        },
        "note7": {
          "caption": "V",
          "colorClass": "noteWhite"
        },
        "note8": {
          "caption": "&sigma;",
          "colorClass": "noteWhite"
        },
        "note9": {
          "caption": "6",
          "colorClass": "noteWhite"
        },
        "note10": {
          "caption": "&delta;",
          "colorClass": "noteWhite"
        },
        "note11": {
          "caption": "&Delta;",
          "colorClass": "noteWhite"
        },
        "noteScale": {
          "colorClass": "noteWhite",
          "caption": "Scale",
          "tiny": "Sc"
        },
        "noteRoot": {
          "colorClass": "noteWhite",
          "captionClass": "noteBassPlayer",
          "caption": "Root",
          "tiny": "R"
        },
        "noteChord": {
          "colorClass": "noteWhite",
          "caption": "Chord",
          "tiny": "Ch"
        },
        "noteChord2": {
          "colorClass": "noteWhite",
          "caption": "Ch2",
          "tiny": "Ch"
        },
        "noteChord3": {
          "colorClass": "noteWhite",
          "caption": "Ch3",
          "tiny": "Ch"
        },
        "noteColornote": {
          "colorClass": "noteWhite",
          "caption": "Colornote",
          "tiny": "C1"
        },
        "noteColornote2": {
          "colorClass": "noteWhite",
          "caption": "C2",
          "tiny": "C2"
        },
        "noteColornote3": {
          "colorClass": "noteWhite",
          "caption": "C3",
          "tiny": "C3"
        },
        "noteChromatic": {
          "colorClass": "noteWhite",
          "caption": "Chromatic",
          "tiny": "c"
        },
        "notePassing": {
          "colorClass": "noteWhite",
          "caption": "Passing",
          "tiny": "p"
        },
        "noteAvoid": {
          "colorClass": "noteWhite",
          "captionClass": "noteBlackout1Caption",
          "caption": "Avoid",
          "tiny": "a1"
        },
        "noteAvoid2": {
          "colorClass": "noteWhite",
          "captionClass": "noteBlackout2Caption",
          "caption": "Avoid",
          "tiny": "a2"
        },
        "noteAvoid3": {
          "colorClass": "noteWhite",
          "caption": "Avoid",
          "tiny": "a3"
        },
        "noteBass": {
          "colorClass": "noteWhite",
          "captionClass": "noteBassPlayer",
          "caption": "Bass",
          "tiny": "B"
        },
        "noteLead": {
          "colorClass": "noteWhite",
          "caption": "Lead",
          "tiny": "L"
        },
        "noteLead2": {
          "colorClass": "noteWhite",
          "caption": "Lead 2",
          "tiny": "L2"
        },
        "noteFinger1": {
          "colorClass": "noteWhite",
          "caption": "Finger1",
          "tiny": "F1"
        },
        "noteFinger2": {
          "colorClass": "noteWhite",
          "caption": "F2",
          "tiny": "F2"
        },
        "noteFinger3": {
          "colorClass": "noteWhite",
          "caption": "F3",
          "tiny": "F3"
        },
        "noteFinger4": {
          "colorClass": "noteWhite",
          "caption": "F4",
          "tiny": "F4"
        },
        "noteFingerT": {
          "colorClass": "noteWhite",
          "caption": "Thumb",
          "tiny": "T"
        }
    }
};

Object.assign(gUserColorDict.dict, gUserColorDictRolesDefault.dict);
gUserColorDictRolesDefault.readOnly = true;

Object.assign(gUserColorDict.dict, gUserColorDictFingeringsDefault.dict);
gUserColorDictFingeringsDefault.readOnly = true;

Object.assign(gUserColorDict.dict, gDefault_CycleOfColors.dict);
gDefault_CycleOfColors.readOnly = true;

const gUserColorDictOEM = {
    readOnly: true,
    computed: true,
    checked: true,
    Default: true,  //special attribute that says base of stylesheets can be here, e.g. "Default+myCoolScheme+myOtherScheme"
    dict: {}
};
Object.assign(gUserColorDictOEM.dict, gUserColorDict.dict);

function resetUserColorsToDefault(){
    Object.assign(gUserColorDict.dict, gUserColorDictOEM.dict);
}
