function makeSong(newIndex){
    let obj = {
        //FIELDS:
            mFrames: [1,2,3,4],
            mCurrentIndex: 0,
        //METHODS:
            make: make,
            showCurrentFrame: showCurrentFrame,
            inc: inc,
            show: show
    }
    obj.make(newIndex);
    return obj;


    function inc(){
        this.mCurrentIndex++;
        this.mCurrentIndex = ( this.mCurrentIndex +4 )%4;

    }

    function showCurrentFrame(){
        return this.mFrames[this.mCurrentIndex];
    }

    function make(newIndex){
        this.mCurrentIndex = newIndex;
    }

    function show(){
        return foo();
    }

    function foo(){
        return "foo was here";
    }

}

function testSongModel(){
    var songModel = makeSong(2);
    var songModel2 = makeSong(0);

    console.log("SongModel2: "+songModel2.showCurrentFrame());
    for (let i=0; i<10; i++){
        console.log("SongModel: "+songModel.showCurrentFrame());
        console.log("SongModel2: "+songModel2.showCurrentFrame());
        songModel.inc();
    }
    console.log("SongModel2: "+songModel2.showCurrentFrame());
    console.log("SongModel2.show: "+songModel2.show());
}
