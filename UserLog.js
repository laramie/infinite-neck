import { Messages } from './Messages.js';
import { hideCmdLine } from './command-line.js';
import {
    DEFAULT_USER_LOG_LEVEL,
    USER_LOG_LEVEL_CAPTIONS,
    USER_LOG_LEVEL_WARNING,
    normalizeUserLogLevel,
    shouldShowUserLogMessage
} from './plugins/userLogLevels.js';



const USER_LOG_MAX_ROWS = 1000;
const USER_LOG_LEVEL_STORAGE_KEY = 'UserLogLevel';

let currentUserLogLevel = null;

export class UserLog {

        // The level is an app-level preference (browser storage), not part of any Song.
        static getLevel(){
            if (currentUserLogLevel === null) {
                let stored = null;
                try {
                    stored = typeof localStorage === 'undefined' ? null : localStorage.getItem(USER_LOG_LEVEL_STORAGE_KEY);
                } catch (error) {
                    stored = null;
                }
                currentUserLogLevel = normalizeUserLogLevel(stored, DEFAULT_USER_LOG_LEVEL);
            }
            return currentUserLogLevel;
        }

        static getLevelCaption(){
            return USER_LOG_LEVEL_CAPTIONS[UserLog.getLevel()];
        }

        // Rows are always written; the level only hides or shows them, so switching to
        // verbose later brings back what was logged earlier.
        static setLevel(level){
            currentUserLogLevel = normalizeUserLogLevel(level, DEFAULT_USER_LOG_LEVEL);
            try {
                if (typeof localStorage !== 'undefined') {
                    localStorage.setItem(USER_LOG_LEVEL_STORAGE_KEY, currentUserLogLevel);
                }
            } catch (error) {
                // storage unavailable: the choice lasts for this page load
            }
            UserLog.applyLevelToRows();
            return currentUserLogLevel;
        }

        static applyLevelToRows(){
            if (typeof document === 'undefined') {
                return;
            }
            const table = document.getElementById('tblUserLog');
            const tbody = table ? table.querySelector('tbody') : null;
            if (!tbody) {
                return;
            }
            const setting = UserLog.getLevel();
            Array.from(tbody.rows).forEach((row) => {
                row.style.display = shouldShowUserLogMessage(row.dataset.level, setting) ? '' : 'none';
            });
        }

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
        
        static addToUserLog(subSystem, message, level){
            const tbody = UserLog.getUserLogTableBody();
            if (!tbody) {
                return false;
            }
        
            const messageLevel = normalizeUserLogLevel(level, USER_LOG_LEVEL_WARNING);
            const row = document.createElement('tr');
            row.dataset.level = messageLevel;
            row.style.display = shouldShowUserLogMessage(messageLevel, UserLog.getLevel()) ? '' : 'none';
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
            UserLog.applyLevelToRows();
            $("#divMessageAndJsonTree").show();
            Messages.showMessagesTab("UserLog");
            hideCmdLine();
            Messages.scrollToMessages();
        }
        
        

}