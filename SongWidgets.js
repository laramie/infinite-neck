export function formatTransposedChordNotesFunctions(noteArray){
    //TODO: replace this hard-coded block with actually formating noteArray, which in this example is [Eb,G,Bb,D] in the key of Eb therefore note Functions [I,III,V,&Delta;]
    // also, use [note1, note2, ... note12] out of this function and look up current color class, ignoring AutoColor in the UI so that it is effectively always AutoColor==true.
    // also: use current Section Function Symbols as set in display option `View > Function Symbols`.
    let result = `<table class='notesFunctionTable' style='display: inline-table;'>
                    <tr class='functionRow'>
                        <td class='noteHatchedRootPink noteWhite'>I</td>
                        <td class='noteBlue4'>III</td>
                        <td class='noteRed4'>V</td>
                        <td class='noteGreen6'>&Delta;</td>
                    </tr>
                    <tr class='notesRow'>
                        <td class='blackKey'>E<em>&flat;</em></td>
                        <td class='whiteKey'>G</td>
                        <td class='blackKey'>B<em>&flat;</em></td>
                        <td class='whiteKey'>D</td>
                    </tr>
                  </table>`;
    return result;              
}
   