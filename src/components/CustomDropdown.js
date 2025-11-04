/* CustomDropdown.js — Custom dropdown component for Minair
 */
export class CustomDropdown {
    constructor(selectElement) {
        this.originalSelect = selectElement;
        this.value = selectElement.value;
        this.options = Array.from(selectElement.options).map(opt => ({
            value: opt.value,
            text: opt.textContent
        }));

        this.createCustomDropdown();
        this.bindEvents();
    }

    createCustomDropdown() {
        // Create custom dropdown structure
        const wrapper = document.createElement('div');
        wrapper.className = 'custom-dropdown';
        if (this.originalSelect.classList.contains('timezone-dropdown')) {
            wrapper.classList.add('timezone-dropdown');
        }

        const toggle = document.createElement('div');
        toggle.className = 'dropdown-toggle';

        const selectedText = document.createElement('span');
        selectedText.className = 'selected-text';
        selectedText.textContent = this.getSelectedText();

        const arrow = document.createElement('div');
        arrow.className = 'dropdown-arrow';

        toggle.appendChild(selectedText);
        toggle.appendChild(arrow);

        const menu = document.createElement('div');
        menu.className = 'dropdown-menu';

        this.options.forEach(option => {
            const item = document.createElement('div');
            item.className = 'dropdown-option';
            item.dataset.value = option.value;
            item.textContent = option.text;
            if (option.value === this.value) {
                item.classList.add('selected');
            }
            menu.appendChild(item);
        });

        wrapper.appendChild(toggle);
        wrapper.appendChild(menu);

        // Replace original select
        this.originalSelect.style.display = 'none';
        this.originalSelect.parentNode.insertBefore(wrapper, this.originalSelect);

        this.wrapper = wrapper;
        this.toggle = toggle;
        this.menu = menu;
        this.selectedText = selectedText;
    }

    bindEvents() {
        // Toggle dropdown
        this.toggle.addEventListener('click', () => {
            this.toggleDropdown();
        });

        // Handle option selection
        this.menu.addEventListener('click', (e) => {
            if (e.target.classList.contains('dropdown-option')) {
                this.selectOption(e.target.dataset.value);
            }
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!this.wrapper.contains(e.target)) {
                this.closeDropdown();
            }
        });

        // Handle keyboard navigation
        this.wrapper.addEventListener('keydown', (e) => {
            this.handleKeyboard(e);
        });
    }

    toggleDropdown() {
        const isOpen = this.menu.classList.contains('open');
        if (isOpen) {
            this.closeDropdown();
        } else {
            this.openDropdown();
        }
    }

    openDropdown() {
        this.toggle.classList.add('open');
        this.menu.classList.add('open');
        this.wrapper.setAttribute('tabindex', '0');
        this.wrapper.focus();
    }

    closeDropdown() {
        this.toggle.classList.remove('open');
        this.menu.classList.remove('open');
        this.wrapper.removeAttribute('tabindex');
    }

    selectOption(value) {
        // Update selected option styling
        this.menu.querySelectorAll('.dropdown-option').forEach(opt => {
            opt.classList.remove('selected');
            if (opt.dataset.value === value) {
                opt.classList.add('selected');
            }
        });

        // Update display and internal state
        this.value = value;
        this.selectedText.textContent = this.getSelectedText();

        // Update original select and trigger change event
        this.originalSelect.value = value;
        this.originalSelect.dispatchEvent(new Event('change', { bubbles: true }));

        this.closeDropdown();
    }

    getSelectedText() {
        const selectedOption = this.options.find(opt => opt.value === this.value);
        return selectedOption ? selectedOption.text : '';
    }

    handleKeyboard(e) {
        const options = Array.from(this.menu.querySelectorAll('.dropdown-option'));
        const currentIndex = options.findIndex(opt => opt.classList.contains('selected'));

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                const nextIndex = Math.min(currentIndex + 1, options.length - 1);
                this.selectOption(options[nextIndex].dataset.value);
                break;
            case 'ArrowUp':
                e.preventDefault();
                const prevIndex = Math.max(currentIndex - 1, 0);
                this.selectOption(options[prevIndex].dataset.value);
                break;
            case 'Enter':
            case ' ':
                e.preventDefault();
                this.toggleDropdown();
                break;
            case 'Escape':
                this.closeDropdown();
                break;
        }
    }

    // Method to programmatically update the dropdown value
    updateValue(newValue) {
        // Update selected option styling
        this.menu.querySelectorAll('.dropdown-option').forEach(opt => {
            opt.classList.remove('selected');
            if (opt.dataset.value === newValue) {
                opt.classList.add('selected');
            }
        });

        // Update display and internal state
        this.value = newValue;
        this.selectedText.textContent = this.getSelectedText();

        // Update original select (but don't trigger change event to avoid loops)
        this.originalSelect.value = newValue;
    }

    // Method to destroy the custom dropdown and restore original select
    destroy() {
        if (this.wrapper && this.wrapper.parentNode) {
            this.wrapper.parentNode.removeChild(this.wrapper);
        }
        this.originalSelect.style.display = '';
    }
}