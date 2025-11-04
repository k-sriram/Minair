/* CustomDatePicker.js — Custom date picker component for Minair
 */
export class CustomDatePicker {
    constructor(inputElement) {
        this.originalInput = inputElement;
        this.value = inputElement.value;
        this.createCustomDatePicker();
        this.bindEvents();
    }

    createCustomDatePicker() {
        // Create custom date picker structure
        const wrapper = document.createElement('div');
        wrapper.className = 'custom-date-picker';

        // Preserve any classes from the original input element
        if (this.originalInput.className) {
            wrapper.classList.add(...this.originalInput.classList);
        }

        const toggle = document.createElement('div');
        toggle.className = 'date-picker-toggle';

        const selectedText = document.createElement('span');
        selectedText.className = 'selected-date-text';
        selectedText.textContent = this.getFormattedDate();

        const arrow = document.createElement('div');
        arrow.className = 'date-picker-arrow';

        toggle.appendChild(selectedText);
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
        this.selectedText = selectedText;
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
        // Toggle calendar
        this.toggle.addEventListener('click', () => {
            this.toggleCalendar();
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
        this.selectedText.textContent = this.getFormattedDate();

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
        this.selectedText.textContent = this.getFormattedDate();
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