function newNote(){
    let obj = {
        //FIELDS:
            //type:"note",
        //METHODS:
            make: construct_note,
            cloneFrom: cloneFrom
    }
    obj.make();
    return obj;

    function construct_note(){
    }
    function cloneFrom(other){
        this.noteName = other.noteName;
        //this.noteNameClass = other.noteNameClass;
        this.colorClass = other.colorClass;
        this.styleNum = other.styleNum;
    }
}
