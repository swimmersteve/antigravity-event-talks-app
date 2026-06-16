document.addEventListener('DOMContentLoaded', () => {
    // Global state
    let releaseNotes = [];
    let activeCategory = 'all';
    let searchQuery = '';
    
    // UI Elements
    const btnRefresh = document.getElementById('btn-refresh');
    const btnExport = document.getElementById('btn-export');
    const themeToggle = document.getElementById('theme-toggle');
    const cacheBadge = document.getElementById('cache-badge');
    const notesGrid = document.getElementById('notes-grid');
    const loadingState = document.getElementById('loading-state');
    const errorState = document.getElementById('error-state');
    const errorMessage = document.getElementById('error-message');
    const emptyState = document.getElementById('empty-state');
    const btnRetry = document.getElementById('btn-retry');
    const btnResetFilters = document.getElementById('btn-reset-filters');
    
    // Search & Filter Elements
    const searchInput = document.getElementById('search-input');
    const clearSearch = document.getElementById('clear-search');
    const categoryFilters = document.getElementById('category-filters');
    
    // Stats Elements
    const statTotal = document.getElementById('stat-total');
    const statFeatures = document.getElementById('stat-features');
    const statIssues = document.getElementById('stat-issues');
    const statDeprecations = document.getElementById('stat-deprecations');
    
    // Tweet Modal Elements
    const tweetModal = document.getElementById('tweet-modal');
    const closeModal = document.getElementById('close-modal');
    const tweetTextarea = document.getElementById('tweet-textarea');
    const charCount = document.getElementById('char-count');
    const progressCircle = document.getElementById('progress-circle');
    const btnSendTweet = document.getElementById('btn-send-tweet');
    const mockTweetText = document.getElementById('mock-tweet-text');
    const mockLinkCard = document.getElementById('mock-link-card');
    const mockLinkDomain = document.getElementById('mock-link-domain');
    const toastContainer = document.getElementById('toast-container');
    
    let currentActiveUpdate = null; // Holds the release note currently in the composer
    
    // Circle progress properties
    const circleRadius = 12;
    const circleCircumference = 2 * Math.PI * circleRadius; // ~75.4
    progressCircle.style.strokeDasharray = `${circleCircumference} ${circleCircumference}`;
    progressCircle.style.strokeDashoffset = circleCircumference;

    // Initialize Theme
    const initTheme = () => {
        const savedTheme = localStorage.getItem('theme') || 'dark';
        if (savedTheme === 'light') {
            document.body.classList.remove('dark-mode');
            document.body.classList.add('light-mode');
            themeToggle.querySelector('i').setAttribute('data-lucide', 'moon');
        } else {
            document.body.classList.add('dark-mode');
            document.body.classList.remove('light-mode');
            themeToggle.querySelector('i').setAttribute('data-lucide', 'sun');
        }
        lucide.createIcons();
    };
    initTheme();

    // Fetch notes on load
    fetchReleaseNotes();

    // Event Listeners
    btnRefresh.addEventListener('click', () => fetchReleaseNotes(true));
    btnRetry.addEventListener('click', () => fetchReleaseNotes(true));
    btnResetFilters.addEventListener('click', resetFilters);
    
    // Theme toggle click event
    themeToggle.addEventListener('click', () => {
        const isLight = document.body.classList.contains('light-mode');
        if (isLight) {
            document.body.classList.remove('light-mode');
            document.body.classList.add('dark-mode');
            localStorage.setItem('theme', 'dark');
            themeToggle.querySelector('i').setAttribute('data-lucide', 'sun');
            showNotification('Switched to Dark Mode', 'success');
        } else {
            document.body.classList.remove('dark-mode');
            document.body.classList.add('light-mode');
            localStorage.setItem('theme', 'light');
            themeToggle.querySelector('i').setAttribute('data-lucide', 'moon');
            showNotification('Switched to Light Mode', 'success');
        }
        lucide.createIcons();
    });

    // Export CSV click event
    btnExport.addEventListener('click', () => exportToCSV());
    
    // Search event
    searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value.toLowerCase().strip();
        clearSearch.style.display = searchQuery.length > 0 ? 'block' : 'none';
        filterAndRenderNotes();
    });
    
    clearSearch.addEventListener('click', () => {
        searchInput.value = '';
        searchQuery = '';
        clearSearch.style.display = 'none';
        filterAndRenderNotes();
        searchInput.focus();
    });

    // Helper to trim and clean spaces
    String.prototype.strip = function() {
        return this.replace(/^\s+|\s+$/g, '');
    };

    // Fetching Logic
    async function fetchReleaseNotes(forceRefresh = false) {
        setLoading(true);
        
        const url = forceRefresh ? '/api/release-notes?refresh=true' : '/api/release-notes';
        
        try {
            const response = await fetch(url);
            const data = await response.json();
            
            if (data.success) {
                releaseNotes = data.data;
                updateCacheBadge(data.source);
                updateStats(releaseNotes);
                buildCategoryFilters(releaseNotes);
                filterAndRenderNotes();
                showNotification(`Successfully fetched ${releaseNotes.length} updates!`, 'success');
            } else {
                showError(data.error || 'Failed parsing release notes XML.');
            }
        } catch (err) {
            console.error('Error fetching release notes:', err);
            showError('Network error. Unable to connect to the backend server.');
        } finally {
            setLoading(false);
        }
    }

    function setLoading(isLoading) {
        if (isLoading) {
            loadingState.style.display = 'flex';
            notesGrid.style.display = 'none';
            errorState.style.display = 'none';
            emptyState.style.display = 'none';
            btnRefresh.classList.add('loading');
            btnRefresh.disabled = true;
        } else {
            loadingState.style.display = 'none';
            btnRefresh.classList.remove('loading');
            btnRefresh.disabled = false;
        }
    }

    function showError(msg) {
        loadingState.style.display = 'none';
        notesGrid.style.display = 'none';
        emptyState.style.display = 'none';
        errorState.style.display = 'flex';
        errorMessage.textContent = msg;
    }

    function updateCacheBadge(source) {
        if (source === 'cache' || source === 'stale_cache') {
            cacheBadge.className = 'badge badge-cache';
            cacheBadge.querySelector('span').textContent = 'Cached';
            cacheBadge.querySelector('i').setAttribute('data-lucide', 'server');
        } else {
            cacheBadge.className = 'badge badge-network';
            cacheBadge.querySelector('span').textContent = 'Live Feed';
            cacheBadge.querySelector('i').setAttribute('data-lucide', 'globe');
        }
        lucide.createIcons();
    }

    // Statistics Calculation
    function updateStats(notes) {
        const total = notes.length;
        const features = notes.filter(n => n.category.toLowerCase() === 'feature').length;
        const issues = notes.filter(n => n.category.toLowerCase() === 'issue').length;
        const deprecations = notes.filter(n => ['deprecation', 'notice'].includes(n.category.toLowerCase())).length;
        
        statTotal.textContent = total;
        statFeatures.textContent = features;
        statIssues.textContent = issues;
        statDeprecations.textContent = deprecations;
        
        // Add click events to stat cards for quick filtering
        document.querySelectorAll('.stat-card').forEach(card => {
            card.onclick = () => {
                const targetFilter = card.getAttribute('data-filter');
                if (targetFilter === 'all') {
                    resetFilters();
                } else {
                    // Find matching pill and click it
                    const pill = document.querySelector(`.pill[data-category="${targetFilter}"]`);
                    if (pill) {
                        pill.click();
                    } else {
                        // Fallback: search or set active category manually
                        activeCategory = targetFilter;
                        document.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
                        filterAndRenderNotes();
                    }
                }
            };
        });
    }

    // Build Category Pills Dynamically
    function buildCategoryFilters(notes) {
        // Find unique categories, filter out empty ones, sort alphabetically
        const categories = [...new Set(notes.map(n => n.category))]
            .filter(c => c && c.trim() !== '')
            .sort();
            
        // Keep the "All" pill and clear the rest
        categoryFilters.innerHTML = '<button class="pill active" data-category="all">All</button>';
        
        categories.forEach(cat => {
            const btn = document.createElement('button');
            btn.className = 'pill';
            btn.setAttribute('data-category', cat);
            btn.textContent = cat;
            
            btn.addEventListener('click', () => {
                document.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
                btn.classList.add('active');
                activeCategory = cat;
                filterAndRenderNotes();
            });
            
            categoryFilters.appendChild(btn);
        });
    }

    function resetFilters() {
        searchInput.value = '';
        searchQuery = '';
        clearSearch.style.display = 'none';
        activeCategory = 'all';
        document.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
        const allPill = document.querySelector('.pill[data-category="all"]');
        if (allPill) allPill.classList.add('active');
        filterAndRenderNotes();
    }

    // Filter and Render Cards
    function filterAndRenderNotes() {
        let filtered = releaseNotes;
        
        // Filter by Category
        if (activeCategory !== 'all') {
            filtered = filtered.filter(n => n.category.toLowerCase() === activeCategory.toLowerCase());
        }
        
        // Filter by Search Query
        if (searchQuery) {
            filtered = filtered.filter(n => 
                n.content_text.toLowerCase().includes(searchQuery) ||
                n.category.toLowerCase().includes(searchQuery) ||
                n.date.toLowerCase().includes(searchQuery)
            );
        }
        
        // Render
        if (filtered.length === 0) {
            notesGrid.style.display = 'none';
            emptyState.style.display = 'flex';
        } else {
            emptyState.style.display = 'none';
            notesGrid.style.display = 'grid';
            renderNotesList(filtered);
        }
    }

    function renderNotesList(notes) {
        notesGrid.innerHTML = '';
        
        notes.forEach(note => {
            const card = document.createElement('div');
            card.className = 'note-card';
            card.setAttribute('data-category', note.category);
            
            const catClass = note.category.toLowerCase();
            const badgeClass = ['feature', 'issue', 'deprecation', 'notice'].includes(catClass) ? catClass : 'general';
            
            card.innerHTML = `
                <div class="card-header">
                    <div class="card-meta">
                        <span class="category-badge ${badgeClass}">${note.category}</span>
                        <span class="card-date">
                            <i data-lucide="calendar"></i>
                            <span>${note.date}</span>
                        </span>
                    </div>
                </div>
                <div class="card-body">
                    ${note.content_html}
                </div>
                <div class="card-actions">
                    <button class="btn-card-action copy-text-btn" title="Copy text content to clipboard">
                        <i data-lucide="file-text"></i>
                        <span>Copy Text</span>
                    </button>
                    <button class="btn-card-action share-link" title="Copy link to clipboard">
                        <i data-lucide="copy"></i>
                        <span>Copy Link</span>
                    </button>
                    <button class="btn-card-action tweet-btn" title="Compose a Tweet about this update">
                        <i data-lucide="twitter"></i>
                        <span>Tweet Update</span>
                    </button>
                </div>
            `;
            
            // Fix all links inside body content to open in new tab
            card.querySelectorAll('.card-body a').forEach(a => {
                a.setAttribute('target', '_blank');
                a.setAttribute('rel', 'noopener noreferrer');
            });
            
            // Click listeners for actions
            card.querySelector('.copy-text-btn').onclick = () => {
                const copyText = `BigQuery ${note.category} (${note.date}): ${note.content_text}\n\nRead more: ${note.link}`;
                navigator.clipboard.writeText(copyText);
                showNotification('Release note text content copied to clipboard!', 'success');
            };
            
            card.querySelector('.share-link').onclick = () => {
                navigator.clipboard.writeText(note.link);
                showNotification('Release note link copied to clipboard!', 'success');
            };
            
            card.querySelector('.tweet-btn').onclick = () => {
                openTweetComposer(note);
            };
            
            notesGrid.appendChild(card);
        });
        
        lucide.createIcons();
    }

    // Tweet Composer Logic
    function openTweetComposer(note) {
        currentActiveUpdate = note;
        
        // Construct a default high-quality tweet message
        // Format: "📢 BigQuery Feature (June 15, 2026): Use Gemini Cloud Assist to analyze SQL... https://docs.cloud.google.com/..."
        const prefix = `📢 BigQuery ${note.category} (${note.date}): `;
        const suffix = `\n\n${note.link}`;
        
        // Calculate remaining room for description text
        // URL counts as 23 characters on Twitter
        const urlLengthInTweet = 23;
        const spacingAndNewlinesLength = 2; // For '\n\n'
        const totalStaticLength = prefix.length + urlLengthInTweet + spacingAndNewlinesLength;
        const availableTextSpace = 280 - totalStaticLength;
        
        // Trim content description if it is too long
        let description = note.content_text;
        
        // Remove duplicate spaces and clean HTML characters if any
        description = description.replace(/\s+/g, ' ');
        
        if (description.length > availableTextSpace) {
            description = description.substring(0, availableTextSpace - 3) + '...';
        }
        
        const defaultTweetText = `${prefix}${description}${suffix}`;
        
        // Set values in composer
        tweetTextarea.value = defaultTweetText;
        updateTweetCount();
        
        // Set mock preview link
        try {
            const domain = new URL(note.link).hostname;
            mockLinkDomain.textContent = domain;
        } catch (e) {
            mockLinkDomain.textContent = 'cloud.google.com';
        }
        
        // Show modal
        tweetModal.style.display = 'flex';
        document.body.style.overflow = 'hidden'; // Disable scroll under modal
        
        // Focus textarea and place cursor before URL
        tweetTextarea.focus();
        const cursorPosition = prefix.length + description.length;
        tweetTextarea.setSelectionRange(cursorPosition, cursorPosition);
        
        lucide.createIcons();
    }

    function closeTweetComposer() {
        tweetModal.style.display = 'none';
        document.body.style.overflow = ''; // Re-enable scroll
        currentActiveUpdate = null;
    }

    closeModal.onclick = closeTweetComposer;
    
    // Close on clicking overlay
    tweetModal.onclick = (e) => {
        if (e.target === tweetModal) {
            closeTweetComposer();
        }
    };
    
    // Handle typing inside tweet composer
    tweetTextarea.oninput = updateTweetCount;

    // Twitter-compliant character counter
    // Twitter wraps all links in t.co which consumes exactly 23 characters
    function calculateTwitterLength(text) {
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        const textWithoutUrls = text.replace(urlRegex, '');
        const urls = text.match(urlRegex) || [];
        
        return textWithoutUrls.length + (urls.length * 23);
    }

    function updateTweetCount() {
        const text = tweetTextarea.value;
        const len = calculateTwitterLength(text);
        const remaining = 280 - len;
        
        // Update circular indicator
        const pct = Math.max(0, Math.min(100, (len / 280) * 100));
        const offset = circleCircumference - (pct / 100) * circleCircumference;
        progressCircle.style.strokeDashoffset = offset;
        
        // Color coding circular progress indicator and text
        if (remaining < 0) {
            progressCircle.style.stroke = '#ef4444'; // Red
            charCount.className = 'char-count-text text-issue';
            btnSendTweet.disabled = true;
        } else if (remaining <= 20) {
            progressCircle.style.stroke = '#f59e0b'; // Amber
            charCount.className = 'char-count-text text-deprecation';
            btnSendTweet.disabled = false;
        } else {
            progressCircle.style.stroke = '#1d9bf0'; // Twitter Blue
            charCount.className = 'char-count-text';
            btnSendTweet.disabled = false;
        }
        
        charCount.textContent = remaining;
        
        // If textarea is empty, disable Post button
        if (text.trim().length === 0) {
            btnSendTweet.disabled = true;
        }
        
        // Update mock tweet body preview
        // Format links in body differently or just display text
        mockTweetText.textContent = text;
        
        // Simple mock link detector for link card preview
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        const urls = text.match(urlRegex) || [];
        if (urls.length > 0) {
            mockLinkCard.style.display = 'flex';
            try {
                const domain = new URL(urls[0]).hostname;
                mockLinkDomain.textContent = domain;
            } catch (e) {
                mockLinkDomain.textContent = 'cloud.google.com';
            }
        } else {
            mockLinkCard.style.display = 'none';
        }
    }

    // Fire Tweet!
    btnSendTweet.onclick = () => {
        const tweetText = tweetTextarea.value;
        const twitterIntentUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`;
        
        // Open Twitter Web Intent
        window.open(twitterIntentUrl, '_blank', 'noopener,noreferrer,width=550,height=420');
        
        closeTweetComposer();
        showNotification('Opening X / Twitter Tweet Composer...', 'success');
    };

    // Export current filtered notes to CSV
    function exportToCSV() {
        let filtered = releaseNotes;
        if (activeCategory !== 'all') {
            filtered = filtered.filter(n => n.category.toLowerCase() === activeCategory.toLowerCase());
        }
        if (searchQuery) {
            filtered = filtered.filter(n => 
                n.content_text.toLowerCase().includes(searchQuery) ||
                n.category.toLowerCase().includes(searchQuery) ||
                n.date.toLowerCase().includes(searchQuery)
            );
        }
        
        if (filtered.length === 0) {
            showNotification('No data matches current search/filters to export!', 'warning');
            return;
        }
        
        const headers = ['ID', 'Date', 'Category', 'Update Link', 'Plaintext Content'];
        
        const escapeCSV = (text) => {
            if (text === null || text === undefined) return '';
            let stringVal = String(text);
            stringVal = stringVal.replace(/"/g, '""');
            if (stringVal.includes(',') || stringVal.includes('"') || stringVal.includes('\n') || stringVal.includes('\r')) {
                return `"${stringVal}"`;
            }
            return stringVal;
        };
        
        const csvRows = [headers.join(',')];
        filtered.forEach(note => {
            const row = [
                escapeCSV(note.id),
                escapeCSV(note.date),
                escapeCSV(note.category),
                escapeCSV(note.link),
                escapeCSV(note.content_text)
            ];
            csvRows.push(row.join(','));
        });
        
        const csvContent = csvRows.join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.setAttribute('href', url);
        const today = new Date().toISOString().split('T')[0];
        link.setAttribute('download', `bigquery_release_notes_${activeCategory}_${today}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        showNotification(`Successfully exported ${filtered.length} updates to CSV!`, 'success');
    }

    // Toast Notification System
    function showNotification(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        
        let iconName = 'info';
        if (type === 'success') iconName = 'check-circle';
        if (type === 'error') iconName = 'alert-triangle';
        if (type === 'warning') iconName = 'alert-circle';
        
        toast.innerHTML = `
            <i data-lucide="${iconName}"></i>
            <span class="toast-message">${message}</span>
            <button class="toast-close">
                <i data-lucide="x"></i>
            </button>
        `;
        
        toast.querySelector('.toast-close').onclick = () => {
            toast.remove();
        };
        
        toastContainer.appendChild(toast);
        lucide.createIcons();
        
        // Auto-remove toast after 4 seconds
        setTimeout(() => {
            toast.style.animation = 'fadeOut 0.3s forwards';
            toast.addEventListener('animationend', () => {
                toast.remove();
            });
        }, 4000);
    }
});
