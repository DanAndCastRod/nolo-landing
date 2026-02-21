// NOLO Landing Page - Advanced Interactions

document.addEventListener('DOMContentLoaded', () => {

    // --- 1. Tab System & Theme Switcher ---
    const tabs = document.querySelectorAll('.tab-btn');
    const contents = document.querySelectorAll('.tab-content');
    const discoBg = document.getElementById('disco-bg');
    const root = document.documentElement;

    const themeColors = {
        'fogata': 'rgba(255, 107, 53, 0.1)',  // Orange low opacity
        'corcel': 'rgba(30, 58, 138, 0.2)',   // Blue low opacity
        'phoenix': 'rgba(251, 191, 36, 0.15)' // Gold low opacity
    };

    const pureColors = {
        'fogata': '#ff6b35',
        'corcel': '#1e3a8a',
        'phoenix': '#fbbf24'
    };

    function switchTab(targetId, theme) {
        // Update Tabs UI
        tabs.forEach(t => t.classList.remove('active'));
        const activeTab = document.querySelector(`.tab-btn[data-target="${targetId}"]`);
        if (activeTab) activeTab.classList.add('active');

        // Update Content
        contents.forEach(c => {
            if (c.id === targetId) {
                c.classList.remove('hidden');
                // Trigger reflow for animation if needed
                c.style.animation = 'none';
                c.offsetHeight; /* trigger reflow */
                c.style.animation = null;
            } else {
                c.classList.add('hidden');
            }
        });

        // Update Dynamic Theme CSS Variable
        root.style.setProperty('--theme-active', pureColors[theme]);

        // Update Background Glow
        if (discoBg) {
            discoBg.style.background = `linear-gradient(to bottom, #0a0a0a, ${themeColors[theme]}, #0a0a0a)`;
        }
    }

    // Initialize Default Tab
    switchTab('fogata', 'fogata');

    // Event Listeners for Tabs
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const target = tab.dataset.target;
            const theme = tab.dataset.theme;
            switchTab(target, theme);
        });
    });

    // --- 2. Parallax Effect ---
    window.addEventListener('scroll', () => {
        const scrolled = window.scrollY;

        document.querySelectorAll('.parallax-element').forEach(el => {
            const speed = parseFloat(el.dataset.speed);
            // Apply transform based on scroll position relative to viewport could be better, 
            // but for simple parallax relative to top works if section is near top.
            // Let's use bounding client rect for safety.
            const rect = el.getBoundingClientRect();
            if (rect.top < window.innerHeight && rect.bottom > 0) {
                const yPos = (window.innerHeight - rect.top) * speed;
                el.style.transform = `translateY(${yPos}px)`;
            }
        });
    });

    // --- 3. Mobile Menu ---
    const menuToggle = document.getElementById('menu-toggle');
    // Implement mobile logic if needed (currently reusing the simple one or relying on visibility toggles)

});
