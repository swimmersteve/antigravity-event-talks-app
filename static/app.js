document.addEventListener('DOMContentLoaded', () => {
    // Global state
    let releaseNotes = [];
    let activeCategory = 'all';
    let searchQuery = '';
    let activeDateRange = 'all'; // 'all', '7', '30', '90'
    let activeStatusFilter = 'all'; // 'all', 'starred', 'unread'
    
    // Persistent Local Storage States for Bookmarks and Read States
    let starredIds = JSON.parse(localStorage.getItem('starred_ids')) || [];
    let readIds = JSON.parse(localStorage.getItem('read_ids')) || [];
    
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
    const dateRangeFilter = document.getElementById('date-range-filter');
    const pillStarred = document.getElementById('pill-starred');
    const pillUnread = document.getElementById('pill-unread');
    
    // Scroll to Top
    const scrollTopBtn = document.getElementById('scroll-to-top');
    
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
    const modalTabs = document.querySelectorAll('.modal-tab');
    
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
    
    // Search event
    searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value.toLowerCase().trim();
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

    // Date range change
    dateRangeFilter.addEventListener('change', (e) => {
        activeDateRange = e.target.value;
        filterAndRenderNotes();
    });

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

    // Status filter clicks
    pillStarred.addEventListener('click', () => {
        if (activeStatusFilter === 'starred') {
            activeStatusFilter = 'all';
            pillStarred.classList.remove('active');
        } else {
            activeStatusFilter = 'starred';
            pillStarred.classList.add('active');
            pillUnread.classList.remove('active');
        }
        filterAndRenderNotes();
    });
    
    pillUnread.addEventListener('click', () => {
        if (activeStatusFilter === 'unread') {
            activeStatusFilter = 'all';
            pillUnread.classList.remove('active');
        } else {
            activeStatusFilter = 'unread';
            pillUnread.classList.add('active');
            pillStarred.classList.remove('active');
        }
        filterAndRenderNotes();
    });

    // Scroll to Top trigger
    window.addEventListener('scroll', () => {
        if (window.scrollY > 400) {
            scrollTopBtn.classList.add('visible');
        } else {
            scrollTopBtn.classList.remove('visible');
        }
    });

    scrollTopBtn.addEventListener('click', () => {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    });

    // Adaptive Modal Tabs Click Handlers
    modalTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            modalTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            const targetTab = tab.getAttribute('data-tab');
            document.querySelectorAll('.modal-tab-content').forEach(content => {
                content.classList.remove('active');
            });
            
            if (targetTab === 'edit') {
                document.getElementById('tab-content-edit').classList.add('active');
            } else {
                document.getElementById('tab-content-preview').classList.add('active');
            }
        });
    });

    // Keyboard Shortcuts Listener
    document.addEventListener('keydown', (e) => {
        // Focus search box on '/' keypress (unless typing in input/textarea)
        if (e.key === '/' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
            e.preventDefault();
            searchInput.focus();
            searchInput.select();
        }
        
        // Close modal on 'Escape'
        if (e.key === 'Escape' && tweetModal.style.display === 'flex') {
            closeTweetComposer();
        }
    });

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
                if (forceRefresh) {
                    showNotification(`Successfully refreshed ${releaseNotes.length} updates!`, 'success');
                }
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
        const categories = [...new Set(notes.map(n => n.category))]
            .filter(c => c && c.trim() !== '')
            .sort();
            
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
        activeDateRange = 'all';
        activeStatusFilter = 'all';
        dateRangeFilter.value = 'all';
        
        document.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
        const allPill = document.querySelector('.pill[data-category="all"]');
        if (allPill) allPill.classList.add('active');
        
        pillStarred.classList.remove('active');
        pillUnread.classList.remove('active');
        
        filterAndRenderNotes();
    }

    // Star / Read State actions
    function toggleStar(noteId) {
        const index = starredIds.indexOf(noteId);
        if (index > -1) {
            starredIds.splice(index, 1);
            showNotification('Removed star bookmark', 'info');
        } else {
            starredIds.push(noteId);
            showNotification('Added star bookmark!', 'success');
        }
        localStorage.setItem('starred_ids', JSON.stringify(starredIds));
        filterAndRenderNotes();
    }

    function toggleRead(noteId) {
        const index = readIds.indexOf(noteId);
        if (index > -1) {
            readIds.splice(index, 1);
        } else {
            readIds.push(noteId);
        }
        localStorage.setItem('read_ids', JSON.stringify(readIds));
        filterAndRenderNotes();
    }

    // Highlighting parser (ignores terms inside HTML tags to prevent tag damage)
    function highlightText(htmlContent, query) {
        if (!query) return htmlContent;
        // Escape regex special characters in user search query
        const escapedQuery = query.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        // Match tag elements OR search keywords. Replace only the search keywords.
        const regex = new RegExp(`(<[^>]+>)|(${escapedQuery})`, 'gi');
        return htmlContent.replace(regex, (match, tag, textMatch) => {
            if (tag) return tag; // Return tag unaffected
            return `<mark class="highlight">${textMatch}</mark>`;
        });
    }

    // Filter and Render Cards
    function filterAndRenderNotes() {
        let filtered = releaseNotes;
        
        // 1. Filter by Category
        if (activeCategory !== 'all') {
            filtered = filtered.filter(n => n.category.toLowerCase() === activeCategory.toLowerCase());
        }
        
        // 2. Filter by Date Range
        if (activeDateRange !== 'all') {
            const daysLimit = parseInt(activeDateRange);
            const now = new Date();
            const limitDate = new Date(now.getTime() - (daysLimit * 24 * 60 * 60 * 1000));
            filtered = filtered.filter(n => {
                if (!n.updated) return false;
                const noteDate = new Date(n.updated);
                return noteDate >= limitDate;
            });
        }

        // 3. Filter by Starred/Unread Status
        if (activeStatusFilter === 'starred') {
            filtered = filtered.filter(n => starredIds.includes(n.id));
        } else if (activeStatusFilter === 'unread') {
            filtered = filtered.filter(n => !readIds.includes(n.id));
        }
        
        // 4. Filter by Search Query
        if (searchQuery) {
            filtered = filtered.filter(n => 
                n.content_text.toLowerCase().includes(searchQuery) ||
                n.category.toLowerCase().includes(searchQuery) ||
                n.date.toLowerCase().includes(searchQuery)
            );
        }
        
        // Render results
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
            const isStarred = starredIds.includes(note.id);
            const isRead = readIds.includes(note.id);
            
            const card = document.createElement('div');
            card.className = `note-card ${isRead ? 'read' : 'unread'}`;
            card.setAttribute('data-category', note.category);
            
            const catClass = note.category.toLowerCase();
            const badgeClass = ['feature', 'issue', 'deprecation', 'notice'].includes(catClass) ? catClass : 'general';
            
            // Highlight text if search query is active
            const highlightedHTML = highlightText(note.content_html, searchQuery);
            
            card.innerHTML = `
                <div class="card-header">
                    <div class="card-meta">
                        <span class="category-badge ${badgeClass}">${note.category}</span>
                        <span class="card-date">
                            <i data-lucide="calendar"></i>
                            <span>${note.date}</span>
                        </span>
                    </div>
                    <div class="card-header-actions">
                        <button class="btn-card-icon star-btn ${isStarred ? 'active' : ''}" title="${isStarred ? 'Unstar update' : 'Star update'}">
                            <i data-lucide="star"></i>
                        </button>
                        <button class="btn-card-icon read-btn ${isRead ? 'active' : ''}" title="${isRead ? 'Mark as Unread' : 'Mark as Read'}">
                            <i data-lucide="${isRead ? 'eye' : 'eye-off'}"></i>
                        </button>
                    </div>
                </div>
                <div class="card-body">
                    ${highlightedHTML}
                </div>
                <div class="card-actions">
                    <button class="btn-card-action copy-text-btn" title="Copy to clipboard">
                        <i data-lucide="clipboard"></i>
                        <span>Copy to Clipboard</span>
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
            
            // Auto Mark as Read when clicking inside card body (excluding buttons or links)
            card.onclick = (e) => {
                if (!e.target.closest('button') && !e.target.closest('a')) {
                    if (!readIds.includes(note.id)) {
                        toggleRead(note.id);
                    }
                }
            };
            
            // Click listeners for actions
            card.querySelector('.star-btn').onclick = (e) => {
                e.stopPropagation();
                toggleStar(note.id);
            };
            
            card.querySelector('.read-btn').onclick = (e) => {
                e.stopPropagation();
                toggleRead(note.id);
            };

            card.querySelector('.copy-text-btn').onclick = (e) => {
                e.stopPropagation();
                const copyText = `BigQuery ${note.category} (${note.date}): ${note.content_text}\n\nRead more: ${note.link}`;
                navigator.clipboard.writeText(copyText);
                showNotification('Copied to clipboard!', 'success');
            };
            
            card.querySelector('.share-link').onclick = (e) => {
                e.stopPropagation();
                navigator.clipboard.writeText(note.link);
                showNotification('Release note link copied to clipboard!', 'success');
            };
            
            card.querySelector('.tweet-btn').onclick = (e) => {
                e.stopPropagation();
                openTweetComposer(note);
            };
            
            notesGrid.appendChild(card);
        });
        
        lucide.createIcons();
    }

    // Tweet Composer Logic
    function openTweetComposer(note) {
        currentActiveUpdate = note;
        
        // Construct default tweet text
        const prefix = `📢 BigQuery ${note.category} (${note.date}): `;
        const suffix = `\n\n${note.link}`;
        const urlLengthInTweet = 23;
        const spacingAndNewlinesLength = 2;
        const totalStaticLength = prefix.length + urlLengthInTweet + spacingAndNewlinesLength;
        const availableTextSpace = 280 - totalStaticLength;
        
        let description = note.content_text;
        description = description.replace(/\s+/g, ' ');
        
        if (description.length > availableTextSpace) {
            description = description.substring(0, availableTextSpace - 3) + '...';
        }
        
        const defaultTweetText = `${prefix}${description}${suffix}`;
        
        // Reset tabs in modal
        modalTabs.forEach(t => t.classList.remove('active'));
        const defaultTab = document.querySelector('.modal-tab[data-tab="edit"]');
        if (defaultTab) defaultTab.classList.add('active');
        
        document.querySelectorAll('.modal-tab-content').forEach(c => c.classList.remove('active'));
        const defaultContent = document.getElementById('tab-content-edit');
        if (defaultContent) defaultContent.classList.add('active');
        
        // Set values
        tweetTextarea.value = defaultTweetText;
        updateTweetCount();
        
        // Domain extraction for mockup
        try {
            const domain = new URL(note.link).hostname;
            mockLinkDomain.textContent = domain;
        } catch (e) {
            mockLinkDomain.textContent = 'cloud.google.com';
        }
        
        // Show modal & freeze page scroll
        tweetModal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
        
        // Focus cursor
        tweetTextarea.focus();
        const cursorPosition = prefix.length + description.length;
        tweetTextarea.setSelectionRange(cursorPosition, cursorPosition);
        
        lucide.createIcons();
    }

    function closeTweetComposer() {
        tweetModal.style.display = 'none';
        document.body.style.overflow = ''; // Unfreeze page scroll
        currentActiveUpdate = null;
    }

    closeModal.onclick = closeTweetComposer;
    
    tweetModal.onclick = (e) => {
        if (e.target === tweetModal) {
            closeTweetComposer();
        }
    };
    
    tweetTextarea.oninput = updateTweetCount;

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
        
        // Update circle indicator
        const pct = Math.max(0, Math.min(100, (len / 280) * 100));
        const offset = circleCircumference - (pct / 100) * circleCircumference;
        progressCircle.style.strokeDashoffset = offset;
        
        // Circle colors
        if (remaining < 0) {
            progressCircle.style.stroke = '#ef4444';
            charCount.className = 'char-count-text text-issue';
            btnSendTweet.disabled = true;
        } else if (remaining <= 20) {
            progressCircle.style.stroke = '#f59e0b';
            charCount.className = 'char-count-text text-deprecation';
            btnSendTweet.disabled = false;
        } else {
            progressCircle.style.stroke = '#1d9bf0';
            charCount.className = 'char-count-text';
            btnSendTweet.disabled = false;
        }
        
        charCount.textContent = remaining;
        
        if (text.trim().length === 0) {
            btnSendTweet.disabled = true;
        }
        
        mockTweetText.textContent = text;
        
        // Mock Link Card detector
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

    btnSendTweet.onclick = () => {
        const tweetText = tweetTextarea.value;
        const twitterIntentUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`;
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
        if (activeDateRange !== 'all') {
            const daysLimit = parseInt(activeDateRange);
            const now = new Date();
            const limitDate = new Date(now.getTime() - (daysLimit * 24 * 60 * 60 * 1000));
            filtered = filtered.filter(n => {
                if (!n.updated) return false;
                const noteDate = new Date(n.updated);
                return noteDate >= limitDate;
            });
        }
        if (activeStatusFilter === 'starred') {
            filtered = filtered.filter(n => starredIds.includes(n.id));
        } else if (activeStatusFilter === 'unread') {
            filtered = filtered.filter(n => !readIds.includes(n.id));
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
