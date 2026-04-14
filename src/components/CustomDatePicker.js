/* CustomDatePicker.js — Custom date picker component for Minair
 */
import { Icons } from '../utils/Icons.js';

export class CustomDatePicker {
    constructor(inputElement) {
        this.originalInput = inputElement;
        this.value = inputElement.value;
        this.createCustomDatePicker();
        this.bindEvents();
        this.origTab = 0;
    }

    createCustomDatePicker() {
        // Create custom date picker structure
        const wrapper = document.createElement('div');
        wrapper.className = 'custom-date-picker';

        // Preserve any classes from the original input element
        if (this.originalInput.className) {
            wrapper.classList.add(...this.originalInput.classList);
        }

        // Preserve any tabindex from the original input element
        this.origTab = this.originalInput.getAttribute('tabindex') || '0';

        const toggle = document.createElement('div');
        toggle.className = 'date-picker-toggle';

        const dateInput = document.createElement('input');
        dateInput.type = 'text';
        dateInput.className = 'selected-date-input';
        dateInput.value = this.value || '';
        dateInput.placeholder = 'Y-M-D';
        dateInput.setAttribute('aria-label', 'Date input in Y-M-D format');
        dateInput.setAttribute('tabindex', this.origTab);
        dateInput.id = this.originalInput.id + '-custom';

        const arrow = document.createElement('button');
        arrow.type = 'button';
        arrow.className = 'date-picker-arrow';
        arrow.innerHTML = Icons.calendar; // Pre-calculated calendar icon
        arrow.setAttribute('aria-label', 'Open calendar'); toggle.appendChild(dateInput);
        arrow.setAttribute('title', 'Open calendar');
        toggle.appendChild(arrow);

        const calendar = document.createElement('div');
        calendar.className = 'date-picker-calendar';
        this.createCalendar(calendar);

        wrapper.appendChild(toggle);
        wrapper.appendChild(calendar);

        // Replace original input
        this.originalInput.style.display = 'none';
        this.originalInput.parentNode.insertBefore(wrapper, this.originalInput);

        this.wrapper = wrapper;
        this.toggle = toggle;
        this.calendar = calendar;
        this.dateInput = dateInput;
        this.arrow = arrow;
    }

    createCalendar(calendar) {
        // Use displayed month if navigating, otherwise use selected date or today
        let displayDate;
        if (this.displayedMonth) {
            displayDate = new Date(this.displayedMonth);
        } else if (this.value) {
            // Parse YYYY-MM-DD format as local date, not UTC
            const parts = this.value.split('-');
            displayDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        } else {
            displayDate = new Date();
        }

        this.createCalendarForMonth(calendar, displayDate.getFullYear(), displayDate.getMonth());
    }

    createCalendarForMonth(calendar, year, month) {
        calendar.innerHTML = '';

        // Calendar header with navigation
        const header = document.createElement('div');
        header.className = 'calendar-header';

        const prevBtn = document.createElement('button');
        prevBtn.className = 'calendar-nav-btn';
        prevBtn.textContent = '‹';
        prevBtn.setAttribute('data-action', 'prev-month');
        prevBtn.setAttribute('title', 'Previous month');

        const monthYear = document.createElement('span');
        monthYear.className = 'calendar-month-year';
        monthYear.textContent = new Date(year, month).toLocaleDateString('en-US', {
            month: 'long',
            year: 'numeric'
        });

        const nextBtn = document.createElement('button');
        nextBtn.className = 'calendar-nav-btn';
        nextBtn.textContent = '›';
        nextBtn.setAttribute('data-action', 'next-month');
        nextBtn.setAttribute('title', 'Next month');

        header.appendChild(prevBtn);
        header.appendChild(monthYear);
        header.appendChild(nextBtn);

        // Days of week header
        const daysHeader = document.createElement('div');
        daysHeader.className = 'calendar-days-header';
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        dayNames.forEach(day => {
            const dayEl = document.createElement('div');
            dayEl.className = 'calendar-day-name';
            dayEl.textContent = day;
            daysHeader.appendChild(dayEl);
        });

        // Calendar days grid
        const daysGrid = document.createElement('div');
        daysGrid.className = 'calendar-days-grid';

        // Get first day of month and number of days
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const startDate = new Date(firstDay);
        startDate.setDate(startDate.getDate() - firstDay.getDay());

        for (let i = 0; i < 42; i++) { // 6 weeks * 7 days
            const date = new Date(startDate);
            date.setDate(startDate.getDate() + i);

            const dayEl = document.createElement('button');
            dayEl.className = 'calendar-day';
            dayEl.textContent = date.getDate();

            // Compare dates properly without timezone issues
            const dateStr = date.getFullYear() + '-' +
                String(date.getMonth() + 1).padStart(2, '0') + '-' +
                String(date.getDate()).padStart(2, '0');
            dayEl.setAttribute('data-date', dateStr);
            dayEl.setAttribute('title', date.toLocaleDateString('en-CA'));

            if (date.getMonth() !== month) {
                dayEl.classList.add('other-month');
            }

            if (this.value && dateStr === this.value) {
                dayEl.classList.add('selected');
            }

            if (this.isToday(date)) {
                dayEl.classList.add('today');
            }

            daysGrid.appendChild(dayEl);
        }

        calendar.appendChild(header);
        calendar.appendChild(daysHeader);
        calendar.appendChild(daysGrid);
    }

    bindEvents() {
        // Open calendar only when clicking the arrow
        this.arrow.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleCalendar();
        });

        // Handle date input validation
        this.dateInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                e.stopPropagation(); // Prevent event from bubbling to wrapper
                this.validateAndSetDate();
            }
        });

        this.dateInput.addEventListener('blur', () => {
            this.validateAndSetDate();
        });

        // Calendar navigation and day selection
        this.calendar.addEventListener('click', (e) => {
            if (e.target.classList.contains('calendar-day') && !e.target.classList.contains('other-month')) {
                const dateStr = e.target.getAttribute('data-date');
                this.selectDate(dateStr);
            } else if (e.target.classList.contains('calendar-nav-btn')) {
                e.preventDefault();
                e.stopPropagation();
                const action = e.target.getAttribute('data-action');
                this.navigateMonth(action);
            }
        });

        // Close calendar when clicking outside
        document.addEventListener('click', (e) => {
            if (!this.wrapper.contains(e.target)) {
                this.closeCalendar();
            }
        });

        // Keyboard navigation
        this.wrapper.addEventListener('keydown', (e) => {
            this.handleKeyboard(e);
        });
    }

    validateAndSetDate() {
        const inputValue = this.dateInput.value.trim();

        // Validate Y-M-D format (flexible: 2023-1-5, 2023-01-05, etc.)
        const dateRegex = /^\d+-\d{1,2}-\d{1,2}$/;

        if (!inputValue) {
            // Empty input is allowed
            this.value = '';
            this.originalInput.value = '';
            this.originalInput.dispatchEvent(new Event('change', { bubbles: true }));
            return;
        }

        if (!dateRegex.test(inputValue)) {
            // Invalid format - restore previous value and show error
            this.dateInput.value = this.value || '';
            this.showDateError('Please enter date in Y-M-D format (e.g., 2023-12-25 or 2023-1-5)');
            return;
        }

        // Validate that it's actually a valid date
        const [year, month, day] = inputValue.split('-').map(Number);
        const testDate = new Date(year, month - 1, day);

        if (testDate.getFullYear() !== year ||
            testDate.getMonth() !== month - 1 ||
            testDate.getDate() !== day) {
            // Invalid date - restore previous value and show error
            this.dateInput.value = this.value || '';
            this.showDateError('Please enter a valid date in Y-M-D format (e.g., 2023-12-25 or 2023-1-5)');
            return;
        }

        // Valid date - update everything
        this.value = inputValue;
        this.originalInput.value = inputValue;
        this.originalInput.dispatchEvent(new Event('change', { bubbles: true }));
        this.updateCalendarSelection();

        // Reset displayed month to selected date's month
        this.displayedMonth = null;
        this.createCalendar(this.calendar);
    }

    showDateError(message) {
        // Use the global notification system if available
        if (window.minairApp && window.minairApp.showNotification) {
            window.minairApp.showNotification(message, 'error');
        } else {
            // Fallback to alert if notification system isn't available
            alert(message);
        }
    }

    toggleCalendar() {
        const isOpen = this.calendar.classList.contains('open');
        if (isOpen) {
            this.closeCalendar();
        } else {
            this.openCalendar();
        }
    }

    openCalendar() {
        this.toggle.classList.add('open');
        this.calendar.classList.add('open');
        this.wrapper.setAttribute('tabindex', '0');
        this.wrapper.focus();
    }

    closeCalendar() {
        this.toggle.classList.remove('open');
        this.calendar.classList.remove('open');
        this.wrapper.removeAttribute('tabindex');
    }

    selectDate(dateStr) {
        this.value = dateStr;
        this.dateInput.value = dateStr;

        // Update original input and trigger change event
        this.originalInput.value = dateStr;
        this.originalInput.dispatchEvent(new Event('change', { bubbles: true }));

        this.closeCalendar();
        this.updateCalendarSelection();
    }

    navigateMonth(action) {
        // Get the current displayed month (or use selected date/today as fallback)
        let displayDate;
        if (this.displayedMonth) {
            displayDate = new Date(this.displayedMonth);
        } else if (this.value) {
            const parts = this.value.split('-');
            displayDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        } else {
            displayDate = new Date();
        }

        if (action === 'prev-month') {
            displayDate.setMonth(displayDate.getMonth() - 1);
        } else if (action === 'next-month') {
            displayDate.setMonth(displayDate.getMonth() + 1);
        }

        // Store the displayed month for navigation
        this.displayedMonth = new Date(displayDate.getFullYear(), displayDate.getMonth(), 1);

        // Recreate calendar with the new month
        this.createCalendarForMonth(this.calendar, displayDate.getFullYear(), displayDate.getMonth());
    }

    updateCalendarSelection() {
        this.calendar.querySelectorAll('.calendar-day').forEach(day => {
            day.classList.remove('selected');
            if (day.getAttribute('data-date') === this.value) {
                day.classList.add('selected');
            }
        });
    }

    getFormattedDate() {
        if (!this.value) return 'Select Date';

        // Return the date in YYYY-MM-DD format
        return this.value;
    }

    isToday(date) {
        const today = new Date();
        return date.toDateString() === today.toDateString();
    }

    handleKeyboard(e) {
        switch (e.key) {
            case 'Enter':
            case ' ':
                e.preventDefault();
                this.toggleCalendar();
                break;
            case 'Escape':
                this.closeCalendar();
                break;
        }
    }

    // Method to programmatically update the date picker value
    updateValue(newValue) {
        this.value = newValue;
        this.dateInput.value = newValue || '';
        this.originalInput.value = newValue;
        this.updateCalendarSelection();
    }

    // Method to destroy the custom date picker and restore original input
    destroy() {
        if (this.wrapper && this.wrapper.parentNode) {
            this.wrapper.parentNode.removeChild(this.wrapper);
        }
        this.originalInput.style.display = '';
    }

    // Static method to initialize all date inputs
    static initializeAll() {
        const dateInputs = document.querySelectorAll('input[type="date"]');
        dateInputs.forEach(input => {
            new CustomDatePicker(input);
        });
    }
}