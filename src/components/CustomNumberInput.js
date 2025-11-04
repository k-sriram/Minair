/* CustomNumberInput.js — Custom number input component with themed spinner buttons
 */
export class CustomNumberInput {
    constructor(wrapper) {
        this.wrapper = wrapper;
        this.input = wrapper.querySelector('input[type="text"]');
        this.incrementBtn = wrapper.querySelector('[data-action="increment"]');
        this.decrementBtn = wrapper.querySelector('[data-action="decrement"]');

        if (!this.input || !this.incrementBtn || !this.decrementBtn) {
            console.warn('CustomNumberInput: Required elements not found');
            return;
        }

        this.min = parseInt(this.input.dataset.min) || 0;
        this.max = parseInt(this.input.dataset.max) || 100;
        this.step = parseInt(this.input.dataset.step) || 1;

        this.init();
    }

    init() {

        // Bind methods to preserve 'this' context
        this.handleIncrement = this.handleIncrement.bind(this);
        this.handleDecrement = this.handleDecrement.bind(this);
        this.handleBlur = this.handleBlur.bind(this);
        this.handleKeydown = this.handleKeydown.bind(this);

        // Attach event listeners
        this.incrementBtn.addEventListener('click', this.handleIncrement);
        this.decrementBtn.addEventListener('click', this.handleDecrement);
        this.input.addEventListener('blur', this.handleBlur);
        this.input.addEventListener('keydown', this.handleKeydown);

        // Initial validation
        this.validateInput();
    }

    validateInput() {
        let value = parseInt(this.input.value) || this.min;
        value = Math.max(this.min, Math.min(this.max, value));
        this.input.value = value;
        return value;
    }

    handleIncrement(e) {
        e.preventDefault();
        e.stopPropagation();
        let value = this.validateInput();
        if (value < this.max) {
            const newValue = value + this.step;
            this.input.value = newValue;
            this.dispatchChangeEvents();
        }
    }

    handleDecrement(e) {
        e.preventDefault();
        e.stopPropagation();
        let value = this.validateInput();
        if (value > this.min) {
            const newValue = value - this.step;
            this.input.value = newValue;
            this.dispatchChangeEvents();
        }
    }

    handleBlur() {
        this.validateInput();
        this.dispatchChangeEvents();
    }

    handleKeydown(e) {
        // Allow: backspace, delete, tab, escape, enter, arrows, and numbers
        if ([46, 8, 9, 27, 13, 37, 39].indexOf(e.keyCode) !== -1 ||
            // Allow Ctrl+A, Ctrl+C, Ctrl+V, Ctrl+X
            (e.keyCode === 65 && e.ctrlKey === true) ||
            (e.keyCode === 67 && e.ctrlKey === true) ||
            (e.keyCode === 86 && e.ctrlKey === true) ||
            (e.keyCode === 88 && e.ctrlKey === true)) {
            return;
        }
        // Ensure that it's a number and stop the keypress
        if ((e.shiftKey || (e.keyCode < 48 || e.keyCode > 57)) && (e.keyCode < 96 || e.keyCode > 105)) {
            e.preventDefault();
        }
    }

    dispatchChangeEvents() {
        // Dispatch both input and change events for compatibility
        this.input.dispatchEvent(new Event('input', { bubbles: true }));
        this.input.dispatchEvent(new Event('change', { bubbles: true }));
    }

    // Public methods for external control
    getValue() {
        return parseInt(this.input.value) || this.min;
    }

    setValue(value) {
        this.input.value = value;
        this.validateInput();
        this.dispatchChangeEvents();
    }

    setMinMax(min, max) {
        this.min = min;
        this.max = max;
        this.input.dataset.min = min;
        this.input.dataset.max = max;
        this.validateInput();
    }

    destroy() {
        // Clean up event listeners
        if (this.incrementBtn) this.incrementBtn.removeEventListener('click', this.handleIncrement);
        if (this.decrementBtn) this.decrementBtn.removeEventListener('click', this.handleDecrement);
        if (this.input) {
            this.input.removeEventListener('blur', this.handleBlur);
            this.input.removeEventListener('keydown', this.handleKeydown);
        }
    }

    // Static method to initialize all custom number inputs on a page
    static initializeAll() {

        // Use setTimeout to ensure DOM is fully ready
        setTimeout(() => {
            const wrappers = document.querySelectorAll('.number-input-wrapper');

            const instances = [];
            wrappers.forEach((wrapper, index) => {
                const instance = new CustomNumberInput(wrapper);
                if (instance.input) { // Only add if successfully initialized
                    instances.push(instance);
                }
            });

            return instances;
        }, 100);
    }
}