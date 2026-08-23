import { Messages } from './Messages.js';
import { hideCmdLine } from './command-line.js';



const USER_LOG_MAX_ROWS = 1000;

export class UserLog {

        static getUserLogTableBody(){
            if (typeof document === 'undefined') {
                return null;
            }
        
            const divUserLog = document.getElementById('divUserLog');
            if (!divUserLog) {
                return null;
            }
        
            let table = document.getElementById('tblUserLog');
            if (!table) {
                table = document.createElement('table');
                table.id = 'tblUserLog';
                const thead = document.createElement('thead');
                const headerRow = document.createElement('tr');
                ['Time', 'SubSystem', 'Message'].forEach((caption) => {
                    const th = document.createElement('th');
                    th.textContent = caption;
                    headerRow.appendChild(th);
                });
                thead.appendChild(headerRow);
                table.appendChild(thead);
                table.appendChild(document.createElement('tbody'));
                divUserLog.appendChild(table);
            }
        
            let tbody = table.querySelector('tbody');
            if (!tbody) {
                tbody = document.createElement('tbody');
                table.appendChild(tbody);
            }
            return tbody;
        }
        
        static getUserLogTime(){
            const now = new Date();
            return [now.getHours(), now.getMinutes(), now.getSeconds()]
                .map((value) => `${value}`.padStart(2, '0'))
                .join(':');
        }
        
        static isQuietUserLogMessage(message = '') {
            const text = `${message || ''}`.trim();
            return text.startsWith('#raise=');
        }
        
        static addToUserLog(subSystem, message){
            const tbody = UserLog.getUserLogTableBody();
            if (!tbody) {
                return false;
            }
        
            const row = document.createElement('tr');
            const timeCell = document.createElement('td');
            const subSystemCell = document.createElement('td');
            const messageCell = document.createElement('td');
        
            timeCell.textContent = UserLog.getUserLogTime();
            subSystemCell.textContent = `${subSystem || ''}`;
            messageCell.innerHTML = `${message || ''}`;
        
            row.appendChild(timeCell);
            row.appendChild(subSystemCell);
            row.appendChild(messageCell);
            tbody.insertBefore(row, tbody.firstChild);
        
            while (tbody.rows.length > USER_LOG_MAX_ROWS) {
                tbody.deleteRow(tbody.rows.length - 1);
            }
        
            return true;
        }
        
        static clearUserLog(){
            const tbody = UserLog.getUserLogTableBody();
            if (tbody) {
                tbody.innerHTML = '';
            }
        }
        
        static showUserLog(){
            UserLog.getUserLogTableBody();
            $("#divMessageAndJsonTree").show();
            Messages.showMessagesTab("UserLog");
            hideCmdLine();
            Messages.scrollToMessages();
        }
        
        

}