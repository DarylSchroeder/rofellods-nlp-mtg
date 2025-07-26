class MTGSearch {
    constructor() {
        // Auto-detect environment and set appropriate API URL
        this.apiUrl = this.getApiUrl();
        this.currentQuery = '';
        this.currentPage = 1;
        this.perPage = 50; // Changed default from 20 to 50
        this.currentFormat = 'ALL'; // Add format tracking
        this.viewMode = 'tiles'; // 'tiles' or 'text'
        this.lastScryfallCall = null; // Cache latest Scryfall API call for bug reports
        
        // Commander selection state
        this.selectedCommander = null; // {name: "Muldrotha, the Gravetide", colors: "UBG"}
        this.commanderCache = null; // Cache commander list from API
        
        // Card name lookahead state
        this.cardNameLookaheadTimeout = null;
        this.currentLookaheadQuery = '';
        this.isShowingLookahead = false;
        
        // Load cached Scryfall call from localStorage
        try {
            const cached = localStorage.getItem('lastScryfallCall');
            if (cached) {
                this.lastScryfallCall = JSON.parse(cached);
            }
        } catch (e) {
            console.warn('Could not load cached Scryfall call:', e);
        }
        this.initializeElements();
        this.loadStateFromURL();
        this.initializeFormatSelector();
        this.bindEvents();
        
        // If we have a query from URL, perform search automatically
        if (this.currentQuery) {
            this.performSearch();
        }
    }

    getApiUrl() {
        const hostname = window.location.hostname;
        const port = window.location.port;
        const urlParams = new URLSearchParams(window.location.search);
        
        // Allow manual override via URL parameter: ?api=local or ?api=prod
        const apiOverride = urlParams.get('api');
        if (apiOverride === 'local') {
            console.log('🔧 Manual override: using localhost:8000 backend');
            return 'http://localhost:8000/search';
        }
        if (apiOverride === 'prod') {
            console.log('🔧 Manual override: using Render backend');
            return 'https://mtg-nlp-search.onrender.com/search';
        }
        
        // Local development detection
        if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0') {
            // Check if we're running on port 8080, 8081, or other typical dev ports
            if (port === '8080' || port === '8081' || port === '3000' || port === '5000') {
                console.log('🏠 Local development detected, using localhost:8000 backend');
                return 'http://localhost:8000/search';  // Local backend
            }
        }
        
        // Production or other environments
        console.log('🌐 Production environment detected, using Render backend');
        return 'https://mtg-nlp-search.onrender.com/search';
    }

    // Load search state from URL parameters
    loadStateFromURL() {
        const urlParams = new URLSearchParams(window.location.search);
        
        // Load search query
        const query = urlParams.get('q');
        if (query) {
            this.currentQuery = decodeURIComponent(query);
            this.searchInput.value = this.currentQuery;
        }
        
        // Load format
        const format = urlParams.get('format');
        if (format && ['ALL', 'standard', 'commander', 'modern', 'pioneer', 'legacy', 'pauper'].includes(format)) {
            this.currentFormat = format;
        }
        
        // Load view mode
        const view = urlParams.get('view');
        if (view && (view === 'tiles' || view === 'text')) {
            this.viewMode = view;
            this.updateViewButtons();
        }
        
        // Load page number
        const page = urlParams.get('page');
        if (page && !isNaN(page) && page > 0) {
            this.currentPage = parseInt(page);
        }
        
        // Load per page
        const perPage = urlParams.get('per_page');
        if (perPage && !isNaN(perPage) && perPage > 0) {
            this.perPage = parseInt(perPage);
        }
    }

    // Update URL with current search state
    updateURL() {
        const params = new URLSearchParams();
        
        if (this.currentQuery) {
            params.set('q', encodeURIComponent(this.currentQuery));
        }
        
        if (this.currentFormat !== 'ALL') {
            params.set('format', this.currentFormat);
        }
        
        if (this.viewMode !== 'tiles') {
            params.set('view', this.viewMode);
        }
        
        if (this.currentPage > 1) {
            params.set('page', this.currentPage.toString());
        }
        
        if (this.perPage !== 50) { // Changed default from 20 to 50
            params.set('per_page', this.perPage.toString());
        }
        
        const newURL = window.location.pathname + (params.toString() ? '?' + params.toString() : '');
        window.history.replaceState({}, '', newURL);
    }

    // Update view mode buttons to reflect current state
    updateViewButtons() {
        const tilesBtn = document.querySelector('[data-view="tiles"]');
        const textBtn = document.querySelector('[data-view="text"]');
        
        if (tilesBtn && textBtn) {
            tilesBtn.classList.toggle('active', this.viewMode === 'tiles');
            textBtn.classList.toggle('active', this.viewMode === 'text');
        }
    }

    // Initialize format selector with current value
    initializeFormatSelector() {
        if (this.formatSelect) {
            this.formatSelect.value = this.currentFormat;
        }
    }

    initializeElements() {
        this.searchInput = document.getElementById('searchInput');
        this.searchButton = document.getElementById('searchButton');
        this.formatSelect = document.getElementById('formatSelect');
        this.loading = document.getElementById('loading');
        this.results = document.getElementById('results');
        this.cardResults = document.getElementById('cardResults');
        this.noResults = document.getElementById('noResults');
        this.error = document.getElementById('error');
        this.resultsCount = document.getElementById('resultsCount');
    }

    bindEvents() {
        this.searchButton.addEventListener('click', () => this.performSearch());
        this.searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.performSearch();
                this.hideSearchDropdown();
            }
        });

        // Search dropdown functionality
        this.searchInput.addEventListener('focus', (e) => {
            if (!e.target.value.trim()) {
                this.showSearchDropdown();
            }
        });

        this.searchInput.addEventListener('input', (e) => {
            const query = e.target.value.trim();
            
            if (query) {
                this.hideSearchDropdown();
                // Start card name lookahead
                this.startCardNameLookahead(query);
            } else {
                this.showSearchDropdown();
                this.hideCardNameLookahead();
            }
        });

        // Hide dropdown when clicking outside
        document.addEventListener('click', (e) => {
            const searchBox = document.querySelector('.search-box');
            if (!searchBox.contains(e.target)) {
                this.hideSearchDropdown();
                this.hideCardNameLookahead();
            }
        });

        // Format selector change event
        this.formatSelect.addEventListener('change', () => {
            if (this.formatSelect.value === 'commander') {
                this.showCommanderModal();
            } else {
                this.currentFormat = this.formatSelect.value;
                this.clearCommander(); // Clear commander when switching away from commander format
                this.performSearch(1); // Reset to page 1 when format changes
            }
        });
        
        // Commander modal events
        const commanderModalInput = document.getElementById('commanderModalInput');
        if (commanderModalInput) {
            commanderModalInput.addEventListener('input', (e) => this.handleCommanderModalInput(e));
            commanderModalInput.addEventListener('focus', () => this.showCommanderModalSuggestions());
            commanderModalInput.addEventListener('blur', () => {
                // Delay hiding to allow clicking on suggestions
                setTimeout(() => this.hideCommanderModalSuggestions(), 200);
            });
            commanderModalInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.setCommander();
                } else if (e.key === 'Escape') {
                    this.cancelCommanderSelection();
                }
            });
        }

        // Focus on search input when page loads (unless we have a query from URL)
        if (!this.currentQuery) {
            this.searchInput.focus();
        }

        // Close modals when clicking outside
        window.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                e.target.style.display = 'none';
            }
        });

        // Close menu when clicking outside
        document.addEventListener('click', (e) => {
            const hamburger = document.querySelector('.hamburger-btn');
            const menu = document.getElementById('navMenu');
            
            if (hamburger && menu && !hamburger.contains(e.target) && !menu.contains(e.target)) {
                hamburger.classList.remove('active');
                menu.classList.remove('show');
            }
            
            // Handle clear commander button clicks using event delegation
            if (e.target.classList.contains('clear-commander-text')) {
                console.log('🎯 Clear commander button clicked via delegation');
                this.clearCommander();
            }
        });
    }

    // Commander Selection Methods
    toggleCommanderSelector() {
        const commanderSelector = document.getElementById('commanderSelector');
        if (this.currentFormat === 'commander') {
            commanderSelector.style.display = 'block';
            this.loadCommanderCache(); // Load commanders if not cached
        } else {
            commanderSelector.style.display = 'none';
            this.clearCommander(); // Clear selection when switching away from commander
        }
    }

    async loadCommanderCache() {
        if (this.commanderCache) return; // Already loaded
        
        try {
            // Get base API URL (remove /search suffix)
            const baseApiUrl = this.apiUrl.replace('/search', '');
            
            // Use full_names=true to get all commanders with proper names
            const response = await fetch(`${baseApiUrl}/commanders?full_names=true`);
            if (response.ok) {
                this.commanderCache = await response.json();
                console.log(`✅ Loaded ${this.commanderCache.length} commanders from API with full names`);
            } else {
                // Fallback to hardcoded list if API not available
                this.commanderCache = this.getHardcodedCommanders();
                console.log('⚠️ Using fallback commander list');
            }
        } catch (error) {
            console.warn('Failed to load commanders from API, using fallback:', error);
            this.commanderCache = this.getHardcodedCommanders();
        }
    }

    getHardcodedCommanders() {
        // Fallback commander list from query_builder.py
        return [
            {name: "Chulane, Teller of Tales", colors: "GWU"},
            {name: "Alesha, Who Smiles at Death", colors: "RWB"},
            {name: "Kenrith, the Returned King", colors: "WUBRG"},
            {name: "Atraxa, Praetors' Voice", colors: "WUBG"},
            {name: "Korvold, Fae-Cursed King", colors: "BRG"},
            {name: "Muldrotha, the Gravetide", colors: "UBG"},
            {name: "Edgar Markov", colors: "RWB"},
            {name: "The Ur-Dragon", colors: "WUBRG"},
            {name: "Meren of Clan Nel Toth", colors: "BG"},
            {name: "Omnath, Locus of Creation", colors: "WUBRG"},
            {name: "Niv-Mizzet, Parun", colors: "UR"},
            {name: "Rhys the Redeemed", colors: "GW"}
        ];
    }

    handleCommanderInput(event) {
        const query = event.target.value.toLowerCase();
        if (query.length < 2) {
            this.hideCommanderSuggestions();
            return;
        }

        const suggestions = this.commanderCache.filter(commander => 
            commander.name.toLowerCase().includes(query)
        ).slice(0, 8); // Limit to 8 suggestions

        this.showCommanderSuggestions(suggestions);
    }

    showCommanderSuggestions(suggestions = []) {
        const suggestionsDiv = document.getElementById('commanderSuggestions');
        
        if (suggestions.length === 0) {
            suggestionsDiv.style.display = 'none';
            return;
        }

        suggestionsDiv.innerHTML = suggestions.map(commander => `
            <div class="commander-suggestion" onclick="mtgSearch.selectCommander('${commander.name}', '${commander.colors}')">
                <span class="name">${commander.name}</span>
                <span class="colors">${commander.colors}</span>
            </div>
        `).join('');
        
        suggestionsDiv.style.display = 'block';
    }

    hideCommanderSuggestions() {
        const suggestionsDiv = document.getElementById('commanderSuggestions');
        if (suggestionsDiv) {
            suggestionsDiv.style.display = 'none';
        }
    }

    selectCommander(name, colors) {
        this.selectedCommander = {name, colors};
        
        // Update UI
        const commanderInput = document.getElementById('commanderInput');
        const selectedDiv = document.getElementById('selectedCommander');
        
        commanderInput.value = '';
        commanderInput.style.display = 'none';
        
        selectedDiv.querySelector('.commander-name').textContent = name;
        selectedDiv.querySelector('.commander-colors').textContent = colors;
        selectedDiv.style.display = 'flex';
        
        this.hideCommanderSuggestions();
        
        // Re-run current search with commander colors
        if (this.currentQuery) {
            this.performSearch(1);
        }
        
        console.log(`🎯 Selected commander: ${name} (${colors})`);
    }

    clearCommander() {
        console.log('🎯 clearCommander() called');
        console.log('Before clear:', {
            selectedCommander: this.selectedCommander,
            currentFormat: this.currentFormat
        });
        
        this.selectedCommander = null;
        
        // Reset format to standard as requested
        this.formatSelect.value = 'standard';
        this.currentFormat = 'standard';
        
        console.log('After clear:', {
            selectedCommander: this.selectedCommander,
            currentFormat: this.currentFormat
        });
        
        // Update UI
        const commanderInput = document.getElementById('commanderInput');
        const selectedDiv = document.getElementById('selectedCommander');
        
        if (commanderInput) {
            commanderInput.value = '';
            commanderInput.style.display = 'block';
        }
        
        if (selectedDiv) {
            selectedDiv.style.display = 'none';
        }
        
        this.hideCommanderSuggestions();
        
        // Update commander status display
        console.log('🔄 About to call updateCommanderStatusDisplay()');
        this.updateCommanderStatusDisplay();
        
        // Re-run current search without commander colors (this will remove coloridentity filter)
        if (this.currentQuery) {
            this.performSearch(1);
        }
        
        console.log('🎯 Cleared commander selection and reset format to standard');
    }

    async performSearch(page = 1) {
        const query = this.searchInput.value.trim();
        if (!query) return;

        // If new search, reset to page 1
        if (query !== this.currentQuery) {
            page = 1;
        }

        this.currentQuery = query;
        this.currentPage = page;
        
        // Update URL with current search state
        this.updateURL();

        this.showLoading();
        this.hideAllSections();

        try {
            // Modify query to include format if not ALL
            let searchQuery = query;
            if (this.currentFormat !== 'ALL') {
                searchQuery = `${query} format:${this.currentFormat}`;
            }
            
            // Add commander color identity if selected
            if (this.selectedCommander && this.currentFormat === 'commander') {
                searchQuery = `${searchQuery} commander:${this.selectedCommander.name}`;
                console.log(`🎯 Adding commander context: ${this.selectedCommander.name} (${this.selectedCommander.colors})`);
            }
            
            const params = new URLSearchParams({
                prompt: searchQuery,
                page: page.toString(),
                per_page: this.perPage.toString()
            });
            
            // Add commander colors as explicit parameter for backend
            if (this.selectedCommander && this.currentFormat === 'commander') {
                params.append('commander_colors', this.selectedCommander.colors);
            }

            const response = await fetch(`${this.apiUrl}?${params}`, {
                // Add timeout for better error handling
                signal: AbortSignal.timeout(30000) // 30 second timeout
            });

            // Check HTTP status first
            if (!response.ok) {
                let errorData;
                try {
                    errorData = await response.json();
                } catch (e) {
                    // If JSON parsing fails, create generic error
                    errorData = { detail: { error: `HTTP ${response.status}: ${response.statusText}` } };
                }
                
                if (response.status === 503) {
                    // Cold start or server loading - show specific message with retry option
                    this.showColdStartError(errorData.detail);
                    return;
                }
                
                if (response.status >= 500) {
                    // Server error
                    this.showError(`Server error: ${errorData.detail?.error || 'Unknown server error'}`);
                    return;
                }
                
                // Other HTTP errors (4xx)
                this.showError(`Request failed: ${errorData.detail?.error || response.statusText}`);
                return;
            }

            const data = await response.json();
            
            // Log NLP parameters to console for debugging
            console.group(`🔍 Search: "${query}"`);
            console.log('📝 Original Query:', query);
            console.log('🧠 NLP Parsed Filters:', data.filters || {});
            console.log('🔎 Scryfall Query:', data.scryfall_query || 'N/A');
            console.log('📊 Results Count:', data.pagination?.total_results || 0);
            console.groupEnd();
            
            // Cache the API call info for bug reports
            this.lastScryfallCall = {
                timestamp: new Date().toISOString(),
                searchQuery: query,
                apiUrl: `${this.apiUrl}?${params}`,
                responseData: data,
                scryfallQuery: data.scryfall_query || null,
                parsedFilters: data.filters || null  // Fixed: API returns 'filters', not 'parsed_filters'
            };
            
            // Store in localStorage for persistence across page refreshes
            try {
                localStorage.setItem('lastScryfallCall', JSON.stringify(this.lastScryfallCall));
            } catch (e) {
                console.warn('Could not save Scryfall call to localStorage:', e);
            }

            this.hideLoading();

            // Legacy error check (should not be needed with proper HTTP status codes)
            if (data.error) {
                console.warn('❌ API Error (legacy):', data.error);
                this.showError(data.error);
                return;
            }

            if (!data.results || data.results.length === 0) {
                console.log('🚫 No results found for query');
                this.showNoResults();
                return;
            }

            this.displayResults(data.results, data.pagination, query);
        } catch (error) {
            console.error('💥 Search error:', error);
            this.hideLoading();
            
            if (error.name === 'TimeoutError') {
                this.showError('Request timed out. The server may be starting up, please try again.');
            } else if (error.name === 'AbortError') {
                this.showError('Request was cancelled. Please try again.');
            } else {
                this.showError('Failed to search. Please check your connection and try again.');
            }
        }
    }

    displayResults(cards, pagination, query) {
        const { page, total_results, total_pages } = pagination;
        
        this.resultsCount.innerHTML = `
            <div class="results-info">
                <span>About ${total_results} results for "${query}" (Page ${page} of ${total_pages})</span>
            </div>
            <div class="results-controls">
                <div class="sort-controls">
                    <label>Sort by:</label>
                    <select id="sortSelect" onchange="mtgSearch.sortResults()">
                        <option value="relevance">Relevance</option>
                        <option value="name-asc">Name (A-Z)</option>
                        <option value="name-desc">Name (Z-A)</option>
                        <option value="cmc">Mana Cost (Low-High)</option>
                        <option value="price">Price (Low-High)</option>
                    </select>
                </div>
                <div class="view-controls">
                    <label>View:</label>
                    <button id="tilesViewBtn" class="view-btn ${this.viewMode === 'tiles' ? 'active' : ''}" onclick="mtgSearch.setViewMode('tiles')">
                        🎴 Tiles
                    </button>
                    <button id="textViewBtn" class="view-btn ${this.viewMode === 'text' ? 'active' : ''}" onclick="mtgSearch.setViewMode('text')">
                        📝 Text
                    </button>
                </div>
                <div class="pagination-controls">
                    <label>Per page:</label>
                    <select id="perPageSelect" onchange="mtgSearch.changePerPage()">
                        <option value="20" ${this.perPage === 20 ? 'selected' : ''}>20</option>
                        <option value="50" ${this.perPage === 50 ? 'selected' : ''}>50</option>
                        <option value="100" ${this.perPage === 100 ? 'selected' : ''}>100</option>
                        <option value="250" ${this.perPage === 250 ? 'selected' : ''}>250</option>
                    </select>
                </div>
            </div>
        `;
        
        // Store original cards for sorting
        this.currentCards = [...cards];
        this.renderCards(this.currentCards);

        // Add pagination controls
        this.addPaginationControls(pagination);

        this.showResults();
    }

    renderCards(cards) {
        this.cardResults.innerHTML = '';
        this.cardResults.className = `card-results ${this.viewMode}-view`;
        
        cards.forEach(card => {
            const cardElement = this.viewMode === 'tiles' 
                ? this.createCardTile(card) 
                : this.createCardTextRow(card);
            this.cardResults.appendChild(cardElement);
        });
    }

    setViewMode(mode) {
        this.viewMode = mode;
        
        // Update URL with new view mode
        this.updateURL();
        
        // Update button states
        document.getElementById('tilesViewBtn').classList.toggle('active', mode === 'tiles');
        document.getElementById('textViewBtn').classList.toggle('active', mode === 'text');
        
        // Re-render current cards with current sort order
        this.sortResults();
    }

    changePerPage() {
        const perPageSelect = document.getElementById('perPageSelect');
        this.perPage = parseInt(perPageSelect.value);
        
        // Reset to page 1 and perform new search
        this.performSearch(1);
    }

    sortResults() {
        const sortSelect = document.getElementById('sortSelect');
        const sortBy = sortSelect.value;
        
        let sortedCards = [...this.currentCards];
        
        switch(sortBy) {
            case 'name-asc':
                sortedCards.sort((a, b) => a.name.localeCompare(b.name));
                break;
            case 'name-desc':
                sortedCards.sort((a, b) => b.name.localeCompare(a.name));
                break;
            case 'cmc':
                sortedCards.sort((a, b) => (a.cmc || 0) - (b.cmc || 0));
                break;
            case 'price':
                sortedCards.sort((a, b) => {
                    const priceA = parseFloat(a.prices?.usd || '999999');
                    const priceB = parseFloat(b.prices?.usd || '999999');
                    return priceA - priceB;
                });
                break;
            default: // relevance - keep original order
                break;
        }
        
        this.renderCards(sortedCards);
    }

    addPaginationControls(pagination) {
        const { page, total_pages, has_prev, has_next } = pagination;
        
        // Remove existing pagination
        const existingPagination = document.querySelector('.pagination');
        if (existingPagination) {
            existingPagination.remove();
        }

        // Create pagination container
        const paginationDiv = document.createElement('div');
        paginationDiv.className = 'pagination';

        // Previous button
        if (has_prev) {
            const prevBtn = this.createPageButton('← Previous', page - 1);
            paginationDiv.appendChild(prevBtn);
        }

        // Page numbers (show current and nearby pages)
        const startPage = Math.max(1, page - 2);
        const endPage = Math.min(total_pages, page + 2);

        if (startPage > 1) {
            paginationDiv.appendChild(this.createPageButton('1', 1));
            if (startPage > 2) {
                const ellipsis = document.createElement('span');
                ellipsis.textContent = '...';
                ellipsis.className = 'pagination-ellipsis';
                paginationDiv.appendChild(ellipsis);
            }
        }

        for (let i = startPage; i <= endPage; i++) {
            const pageBtn = this.createPageButton(i.toString(), i);
            if (i === page) {
                pageBtn.classList.add('current');
            }
            paginationDiv.appendChild(pageBtn);
        }

        if (endPage < total_pages) {
            if (endPage < total_pages - 1) {
                const ellipsis = document.createElement('span');
                ellipsis.textContent = '...';
                ellipsis.className = 'pagination-ellipsis';
                paginationDiv.appendChild(ellipsis);
            }
            paginationDiv.appendChild(this.createPageButton(total_pages.toString(), total_pages));
        }

        // Next button
        if (has_next) {
            const nextBtn = this.createPageButton('Next →', page + 1);
            paginationDiv.appendChild(nextBtn);
        }

        // Add pagination to top-right of results
        const paginationTop = document.querySelector('.results-pagination-top');
        if (paginationTop) {
            paginationTop.appendChild(paginationDiv);
        }
    }

    createPageButton(text, pageNum) {
        const button = document.createElement('button');
        button.textContent = text;
        button.className = 'pagination-btn';
        button.addEventListener('click', () => {
            this.performSearch(pageNum);
            // Scroll to top of results container instead of whole page
            const resultsContainer = document.querySelector('.results-container');
            if (resultsContainer) {
                resultsContainer.scrollTo({ top: 0, behavior: 'smooth' });
            }
        });
        return button;
    }

    createCardTile(card) {
        const cardTile = document.createElement('div');
        cardTile.className = 'card-tile';

        // Get card image
        const imageUrl = card.image_uris?.normal || card.image_uris?.large || card.image_uris?.small;
        
        // Parse mana cost
        const manaCost = this.parseManaSymbols(card.mana_cost || '');
        
        // Get TCGPlayer link
        const tcgLink = card.purchase_uris?.tcgplayer || '#';
        
        // Format price
        const price = card.prices?.usd ? `$${card.prices.usd}` : 'N/A';
        
        // Format power/toughness
        const powerToughness = card.power && card.toughness ? `${card.power}/${card.toughness}` : '';
        
        // Truncate oracle text
        const oracleText = card.oracle_text ? this.truncateText(card.oracle_text, 120) : '';

        cardTile.innerHTML = `
            <div class="card-image-container">
                ${imageUrl ? `
                    <img src="${imageUrl}" 
                         alt="${card.name}" 
                         class="card-image"
                         onmouseover="mtgSearch.showLargeImage(event, '${imageUrl}')"
                         onmouseout="mtgSearch.hideLargeImage()"
                         loading="lazy">
                ` : '<div class="no-image">No Image</div>'}
            </div>
            <div class="card-info">
                <div class="card-header">
                    <span class="card-name">${card.name}</span>
                    ${manaCost ? `<div class="mana-cost">${manaCost}</div>` : ''}
                </div>
                <div class="card-type">${card.type_line}</div>
                ${oracleText ? `<div class="card-text">${oracleText}</div>` : ''}
                <div class="card-footer">
                    <div class="card-stats">
                        ${powerToughness ? `<span class="power-toughness">${powerToughness}</span>` : ''}
                        ${card.rarity ? `<span class="rarity ${card.rarity}">${this.capitalizeFirst(card.rarity)}</span>` : ''}
                        <span class="price">${price}</span>
                    </div>
                    <div class="card-actions">
                        ${tcgLink !== '#' ? `<a href="${tcgLink}" target="_blank" class="tcg-link" onclick="event.stopPropagation()">Buy</a>` : ''}
                        <button class="report-card-btn" onclick="event.stopPropagation(); mtgSearch.reportCardBug('${card.name.replace(/'/g, "\\'")}', ${JSON.stringify(card).replace(/'/g, "\\'").replace(/"/g, '&quot;')})">
                            🐛
                        </button>
                    </div>
                </div>
            </div>
        `;

        // Add click handler to open modal
        cardTile.addEventListener('click', () => {
            this.openCardModal(card);
        });

        // Add cursor pointer style
        cardTile.style.cursor = 'pointer';

        return cardTile;
    }

    createCardTextRow(card) {
        const cardRow = document.createElement('div');
        cardRow.className = 'card-text-row';

        // Parse mana cost
        const manaCost = this.parseManaSymbols(card.mana_cost || '');
        
        // Get TCGPlayer link
        const tcgLink = card.purchase_uris?.tcgplayer || '#';
        
        // Format price
        const price = card.prices?.usd ? `$${card.prices.usd}` : 'N/A';
        
        // Format power/toughness
        const powerToughness = card.power && card.toughness ? `${card.power}/${card.toughness}` : '';

        cardRow.innerHTML = `
            <div class="text-row-header">
                <div class="text-row-main">
                    <span class="card-name">${card.name}</span>
                    ${manaCost ? `<span class="mana-cost">${manaCost}</span>` : ''}
                    <span class="card-type">${card.type_line}</span>
                </div>
                <div class="text-row-stats">
                    ${powerToughness ? `<span class="power-toughness">${powerToughness}</span>` : ''}
                    ${card.rarity ? `<span class="rarity ${card.rarity}">${this.capitalizeFirst(card.rarity)}</span>` : ''}
                    <span class="price">${price}</span>
                </div>
            </div>
            <div class="text-row-actions">
                ${tcgLink !== '#' ? `<a href="${tcgLink}" target="_blank" class="tcg-link" onclick="event.stopPropagation()">Buy</a>` : ''}
                <button class="report-card-btn" onclick="event.stopPropagation(); mtgSearch.reportCardIssue('${card.name.replace(/'/g, "\\'")}', '${card.id}')">
                    🐛
                </button>
            </div>
        `;

        // Add click handler to open modal
        cardRow.addEventListener('click', () => {
            this.openCardModal(card);
        });

        return cardRow;
    }

    showLargeImage(event, imageUrl) {
        // Remove existing large image
        this.hideLargeImage();
        
        const largeImage = document.createElement('div');
        largeImage.className = 'large-image-overlay';
        largeImage.innerHTML = `<img src="${imageUrl}" alt="Large card image">`;
        
        document.body.appendChild(largeImage);
        
        // Position near mouse
        const rect = event.target.getBoundingClientRect();
        largeImage.style.left = (rect.right + 10) + 'px';
        largeImage.style.top = rect.top + 'px';
        
        // Adjust if off-screen
        setTimeout(() => {
            const imgRect = largeImage.getBoundingClientRect();
            if (imgRect.right > window.innerWidth) {
                largeImage.style.left = (rect.left - imgRect.width - 10) + 'px';
            }
            if (imgRect.bottom > window.innerHeight) {
                largeImage.style.top = (window.innerHeight - imgRect.height - 10) + 'px';
            }
        }, 10);
    }

    hideLargeImage() {
        const existing = document.querySelector('.large-image-overlay');
        if (existing) {
            existing.remove();
        }
    }

    parseManaSymbols(manaCost) {
        if (!manaCost) return '';
        
        // Remove outer braces and split by individual symbols
        const symbols = manaCost.match(/\{[^}]+\}/g) || [];
        
        return symbols.map(symbol => {
            const clean = symbol.replace(/[{}]/g, '');
            
            // Handle different mana types
            if (/^\d+$/.test(clean)) {
                return `<span class="mana-symbol mana-c">${clean}</span>`;
            }
            
            const colorMap = {
                'W': 'mana-w',
                'U': 'mana-u', 
                'B': 'mana-b',
                'R': 'mana-r',
                'G': 'mana-g',
                'C': 'mana-c'
            };
            
            const colorClass = colorMap[clean] || 'mana-c';
            return `<span class="mana-symbol ${colorClass}">${clean}</span>`;
        }).join('');
    }

    truncateText(text, maxLength) {
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength).trim() + '...';
    }

    capitalizeFirst(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    showLoading() {
        this.loading.classList.remove('hidden');
    }

    hideLoading() {
        this.loading.classList.add('hidden');
    }

    showResults() {
        this.results.classList.remove('hidden');
    }

    showNoResults() {
        this.noResults.classList.remove('hidden');
    }

    showError(message) {
        this.error.querySelector('p').textContent = message;
        this.error.classList.remove('hidden');
    }

    showColdStartError(errorDetail) {
        const retryAfter = errorDetail.retry_after || 10;
        const errorType = errorDetail.error_type || 'cold_start';
        
        this.error.innerHTML = `
            <div class="cold-start-message">
                <h3>🔄 ${errorType === 'loading' ? 'Server Loading Data' : 'Server Starting Up'}</h3>
                <p>${errorDetail.error}</p>
                <div class="retry-controls">
                    <button onclick="mtgSearch.retryLastSearch()" class="retry-btn">
                        Retry Now
                    </button>
                    <span class="retry-info">Auto-retry in <span id="countdown">${retryAfter}</span> seconds</span>
                </div>
            </div>
        `;
        this.error.classList.remove('hidden');
        
        // Start countdown and auto-retry
        this.startRetryCountdown(retryAfter);
    }

    startRetryCountdown(seconds) {
        const countdownElement = document.getElementById('countdown');
        let remaining = seconds;
        
        const countdownInterval = setInterval(() => {
            remaining--;
            if (countdownElement) {
                countdownElement.textContent = remaining;
            }
            
            if (remaining <= 0) {
                clearInterval(countdownInterval);
                this.retryLastSearch();
            }
        }, 1000);
        
        // Store interval ID so we can clear it if user manually retries
        this.retryCountdownInterval = countdownInterval;
    }

    retryLastSearch() {
        // Clear any existing countdown
        if (this.retryCountdownInterval) {
            clearInterval(this.retryCountdownInterval);
            this.retryCountdownInterval = null;
        }
        
        // Retry the last search
        if (this.currentQuery) {
            console.log('🔄 Retrying search:', this.currentQuery);
            this.performSearch(this.currentPage);
        }
    }

    hideAllSections() {
        this.results.classList.add('hidden');
        this.noResults.classList.add('hidden');
        this.error.classList.add('hidden');
    }

    // Bug reporting methods
    reportSearchIssue(query, page) {
        const title = `Search Issue: "${query}"`;
        const body = this.generateSearchIssueBody(query, page);
        this.openGitHubIssue(title, body);
    }

    reportCardIssue(cardName, cardId) {
        const title = `Card Issue: ${cardName}`;
        const body = this.generateCardIssueBody(cardName, cardId);
        this.openGitHubIssue(title, body);
    }

    generateSearchIssueBody(query, page) {
        const timestamp = new Date().toISOString();
        const reproductionUrl = window.location.href;
        
        let scryfallInfo = '';
        if (this.lastScryfallCall) {
            scryfallInfo = `

### Scryfall API Call Debug Info
**Timestamp:** ${this.lastScryfallCall.timestamp}
**Backend API URL:** \`${this.lastScryfallCall.apiUrl}\`
**Parsed Filters:** 
\`\`\`json
${JSON.stringify(this.lastScryfallCall.parsedFilters, null, 2)}
\`\`\`
**Scryfall Query:** \`${this.lastScryfallCall.scryfallQuery || 'N/A'}\`
`;
        }
        
        return `## Search Issue Report

**Search Query:** \`${query}\`
**Page:** ${page}
**Timestamp:** ${timestamp}

### 🔗 Reproduction URL
**Click to reproduce:** ${reproductionUrl}
${scryfallInfo}

### Issue Description
<!-- Please describe what went wrong with this search -->


### Expected Results
<!-- What results did you expect to see? -->


### Actual Results
<!-- What results did you actually get? -->


### Additional Context
<!-- Any other information that might help -->


---
*Auto-generated from RofelloDS MTG Search*`;
    }

    generateCardIssueBody(cardName, cardId) {
        const timestamp = new Date().toISOString();
        const reproductionUrl = window.location.href;
        
        let scryfallInfo = '';
        if (this.lastScryfallCall) {
            scryfallInfo = `

### Scryfall API Call Debug Info
**Timestamp:** ${this.lastScryfallCall.timestamp}
**Backend API URL:** \`${this.lastScryfallCall.apiUrl}\`
**Parsed Filters:** 
\`\`\`json
${JSON.stringify(this.lastScryfallCall.parsedFilters, null, 2)}
\`\`\`
**Scryfall Query:** \`${this.lastScryfallCall.scryfallQuery || 'N/A'}\`
`;
        }
        
        return `## Card Issue Report

**Card Name:** ${cardName}
**Card ID:** \`${cardId}\`
**Search Query:** \`${this.currentQuery}\`
**Page:** ${this.currentPage}
**Timestamp:** ${timestamp}

### 🔗 Reproduction URL
**Click to reproduce:** ${reproductionUrl}
${scryfallInfo}

### Issue Description
<!-- Please describe what's wrong with this card result -->


### Expected Behavior
<!-- What should have happened? -->


### Actual Behavior
<!-- What actually happened? -->


### Steps to Reproduce
1. Search for: \`${this.currentQuery}\`
2. Go to page ${this.currentPage}
3. Look at card: ${cardName}

### Additional Context
<!-- Any other information that might help -->


---
*Auto-generated from RofelloDS MTG Search*`;
    }

    openGitHubIssue(title, body) {
        const repoUrl = 'https://github.com/DarylSchroeder/rofellods-nlp-mtg';
        const issueUrl = `${repoUrl}/issues/new?${new URLSearchParams({
            title: title,
            body: body,
            labels: 'bug,user-reported'
        })}`;
        
        window.open(issueUrl, '_blank');
    }

    // Navigation methods
    toggleMenu() {
        const hamburger = document.querySelector('.hamburger-btn');
        const menu = document.getElementById('navMenu');
        
        hamburger.classList.toggle('active');
        menu.classList.toggle('show');
    }

    showAbout() {
        this.closeMenu();
        document.getElementById('aboutModal').style.display = 'block';
    }

    showContact() {
        this.closeMenu();
        document.getElementById('contactModal').style.display = 'block';
    }

    closeModal(modalId) {
        document.getElementById(modalId).style.display = 'none';
    }

    closeMenu() {
        const hamburger = document.querySelector('.hamburger-btn');
        const menu = document.getElementById('navMenu');
        
        hamburger.classList.remove('active');
        menu.classList.remove('show');
    }

    // Sample searches functionality
    toggleSampleSearches() {
        const sampleMenu = document.getElementById('sampleSearchesMenu');
        
        if (sampleMenu.style.display === 'none') {
            sampleMenu.style.display = 'block';
            this.populateSampleSearches();
        } else {
            sampleMenu.style.display = 'none';
        }
    }

    populateSampleSearches() {
        const sampleList = document.getElementById('sampleListMenu');
        
        const sampleCategories = {
            'Basic Searches': [
                '1 mana counterspell',
                'fetchland',
                'azorius removal',
                '3 mana simic creature',
                'red burn spell'
            ],
            'Mana Costs': [
                '2 mana instant',
                '4 cost artifact',
                '0 mana spell',
                '6+ mana creature',
                'X cost spell'
            ],
            'Guild Colors': [
                'azorius counterspell',
                'simic ramp',
                'rakdos removal',
                'selesnya token',
                'izzet draw'
            ],
            'Card Types': [
                'legendary creature',
                'artifact creature',
                'enchantment removal',
                'planeswalker',
                'tribal instant'
            ],
            'Effects & Mechanics': [
                'counterspell',
                'card draw',
                'ramp spell',
                'removal spell',
                'token generator'
            ],
            'Land Types': [
                'shockland',
                'triome',
                'basic land',
                'dual land',
                'utility land'
            ],
            'Commander Searches': [
                'counterspell for my Chulane deck',
                'removal for Atraxa',
                'ramp for Omnath',
                'draw for Niv-Mizzet',
                'token for Rhys'
            ],
            'Advanced Queries': [
                'blue instant that counters spells',
                'green creature with trample',
                'artifact that costs 2 or less',
                'red sorcery that deals damage',
                'white enchantment that gains life'
            ]
        };

        let html = '';
        for (const [category, searches] of Object.entries(sampleCategories)) {
            html += `
                <div class="sample-category-menu">
                    <h4>${category}</h4>
                    <div class="sample-links-menu">
                        ${searches.map(search => 
                            `<span class="sample-link-menu" onclick="mtgSearch.runSampleSearch('${search.replace(/'/g, "\\'")}')">${search}</span>`
                        ).join('')}
                    </div>
                </div>
            `;
        }
        
        sampleList.innerHTML = html;
    }

    runSampleSearch(query) {
        this.searchInput.value = query;
        this.performSearch();
        
        // Close the hamburger menu after selection
        this.closeMenu();
        
        // Close sample searches menu
        const sampleMenu = document.getElementById('sampleSearchesMenu');
        sampleMenu.style.display = 'none';
    }

    // Search dropdown functionality
    showSearchDropdown() {
        const dropdown = document.getElementById('searchDropdown');
        if (dropdown) {
            this.populateSearchDropdown();
            dropdown.classList.remove('hidden');
        }
    }

    hideSearchDropdown() {
        const dropdown = document.getElementById('searchDropdown');
        if (dropdown) {
            dropdown.classList.add('hidden');
        }
        this.isShowingLookahead = false;
    }

    populateSearchDropdown() {
        const dropdownContent = document.getElementById('dropdownContent');
        if (!dropdownContent) return;

        const sampleCategories = {
            'Basic Searches': [
                '1 mana counterspell',
                'azorius removal',
                'fetchland',
                'shockland',
                'ramp spell',
                'card draw'
            ],
            'Mana Costs': [
                '2 mana creature',
                '3 cmc artifact',
                'zero cost spell',
                'X cost spell'
            ],
            'Colors & Guilds': [
                'blue counterspell',
                'white removal',
                'simic ramp',
                'orzhov removal',
                'red burn'
            ],
            'Card Types': [
                'legendary creature',
                'artifact creature',
                'instant or sorcery',
                'planeswalker',
                'enchantment'
            ],
            'Effects': [
                'destroy target creature',
                'draw cards',
                'gain life',
                'deal damage',
                'tutor'
            ]
        };

        let html = '';
        for (const [category, searches] of Object.entries(sampleCategories)) {
            html += `<div class="dropdown-category">${category}</div>`;
            searches.forEach(search => {
                html += `<div class="dropdown-item" onclick="mtgSearch.selectDropdownItem('${search.replace(/'/g, "\\'")}')">${search}</div>`;
            });
        }

        dropdownContent.innerHTML = html;
    }

    selectDropdownItem(query) {
        this.searchInput.value = query;
        this.hideSearchDropdown();
        this.performSearch();
    }

    // Card Name Lookahead functionality
    startCardNameLookahead(query) {
        // Clear existing timeout
        if (this.cardNameLookaheadTimeout) {
            clearTimeout(this.cardNameLookaheadTimeout);
        }
        
        // Set a short delay to avoid too many API calls
        this.cardNameLookaheadTimeout = setTimeout(() => {
            this.fetchCardNameSuggestions(query);
        }, 300);
    }
    
    async fetchCardNameSuggestions(query) {
        // Don't show lookahead for very short queries
        if (query.length < 3) {
            this.hideCardNameLookahead();
            return;
        }
        
        // Check if query looks like it might be a card name (starts with capital letter or quotes)
        const mightBeCardName = /^[A-Z"]/.test(query) || query.includes(',');
        if (!mightBeCardName) {
            this.hideCardNameLookahead();
            return;
        }
        
        try {
            const baseApiUrl = this.apiUrl.replace('/search', '');
            const response = await fetch(`${baseApiUrl}/card-names?query=${encodeURIComponent(query)}&limit=8`);
            
            if (response.ok) {
                const data = await response.json();
                if (data.loaded && data.suggestions.length > 0) {
                    this.showCardNameLookahead(data.suggestions, data.is_exact_match);
                } else {
                    this.hideCardNameLookahead();
                }
            } else {
                this.hideCardNameLookahead();
            }
        } catch (error) {
            console.warn('Card name lookahead error:', error);
            this.hideCardNameLookahead();
        }
    }
    
    showCardNameLookahead(suggestions, isExactMatch) {
        const dropdown = document.getElementById('searchDropdown');
        const dropdownContent = document.getElementById('dropdownContent');
        
        if (!dropdown || !dropdownContent) return;
        
        // Update dropdown header
        const header = dropdown.querySelector('.dropdown-header');
        if (header) {
            header.textContent = isExactMatch ? 'Exact Card Match' : 'Card Name Suggestions';
        }
        
        // Populate with card name suggestions
        let html = '';
        suggestions.forEach(cardName => {
            const escapedName = cardName.replace(/'/g, "\\'").replace(/"/g, '&quot;');
            html += `<div class="dropdown-item card-name-suggestion" onclick="mtgSearch.selectCardName('${escapedName}')">${cardName}</div>`;
        });
        
        dropdownContent.innerHTML = html;
        dropdown.classList.remove('hidden');
        this.isShowingLookahead = true;
    }
    
    hideCardNameLookahead() {
        if (this.isShowingLookahead) {
            this.hideSearchDropdown();
            this.isShowingLookahead = false;
        }
    }
    
    selectCardName(cardName) {
        this.searchInput.value = cardName;
        this.hideCardNameLookahead();
        this.performSearch();
    }

    // Card Modal functionality
    openCardModal(card) {
        const modal = document.getElementById('cardModal');
        const modalImage = document.getElementById('modalCardImage');
        const modalName = document.getElementById('modalCardName');
        const modalType = document.getElementById('modalCardType');
        const modalMana = document.getElementById('modalCardMana');
        const modalStats = document.getElementById('modalCardStats');
        const modalText = document.getElementById('modalCardText');
        const modalTcgLink = document.getElementById('modalTcgLink');
        const modalScryfallLink = document.getElementById('modalScryfallLink');

        // Populate modal content
        modalImage.src = card.image_uris?.normal || card.image_uris?.large || '';
        modalImage.alt = `${card.name} card image`;
        modalName.textContent = card.name;
        modalType.textContent = card.type_line;
        
        // Mana cost
        const manaCost = this.parseManaSymbols(card.mana_cost || '');
        modalMana.innerHTML = manaCost ? `<strong>Mana Cost:</strong> ${manaCost}` : '';
        
        // Stats
        const stats = [];
        if (card.power && card.toughness) {
            stats.push(`<span class="card-modal-stat">Power/Toughness: ${card.power}/${card.toughness}</span>`);
        }
        if (card.rarity) {
            stats.push(`<span class="card-modal-stat">Rarity: ${this.capitalizeFirst(card.rarity)}</span>`);
        }
        if (card.set_name) {
            stats.push(`<span class="card-modal-stat">Set: ${card.set_name}</span>`);
        }
        if (card.prices?.usd) {
            stats.push(`<span class="card-modal-stat">Price: $${card.prices.usd}</span>`);
        }
        modalStats.innerHTML = stats.join('');
        
        // Oracle text
        modalText.textContent = card.oracle_text || 'No oracle text available.';
        
        // Links
        const tcgLink = card.purchase_uris?.tcgplayer;
        if (tcgLink && tcgLink !== '#') {
            modalTcgLink.href = tcgLink;
            modalTcgLink.style.display = 'inline-block';
        } else {
            modalTcgLink.style.display = 'none';
        }
        
        modalScryfallLink.href = card.scryfall_uri || '#';
        
        // Show modal
        modal.classList.add('show');
        document.body.style.overflow = 'hidden';
        
        // Close on background click
        modal.onclick = (e) => {
            if (e.target === modal) {
                this.closeCardModal();
            }
        };
        
        // Close on escape key
        const escapeHandler = (e) => {
            if (e.key === 'Escape') {
                this.closeCardModal();
                document.removeEventListener('keydown', escapeHandler);
            }
        };
        document.addEventListener('keydown', escapeHandler);
    }

    closeCardModal() {
        const modal = document.getElementById('cardModal');
        modal.classList.remove('show');
        document.body.style.overflow = '';
        modal.onclick = null;
    }

    // Enhanced bug reporting with card details
    reportCardBug(cardName, cardData) {
        const query = this.currentQuery || 'Unknown query';
        const reproductionUrl = window.location.href;
        
        let scryfallInfo = '';
        if (this.lastScryfallCall) {
            scryfallInfo = `

### Scryfall API Call Debug Info
**Timestamp:** ${this.lastScryfallCall.timestamp}
**Backend API URL:** \`${this.lastScryfallCall.apiUrl}\`
**Parsed Filters:** 
\`\`\`json
${JSON.stringify(this.lastScryfallCall.parsedFilters, null, 2)}
\`\`\`
**Scryfall Query:** \`${this.lastScryfallCall.scryfallQuery || 'N/A'}\`
`;
        }
        
        const cardDetails = cardData ? `
**Card Details:**
- **Name:** ${cardData.name}
- **Mana Cost:** ${cardData.mana_cost || 'N/A'}
- **Type:** ${cardData.type_line || 'N/A'}
- **Oracle Text:** 
\`\`\`
${cardData.oracle_text || 'N/A'}
\`\`\`
- **Set:** ${cardData.set_name || 'N/A'} (${(cardData.set || 'N/A').toUpperCase()})
- **Scryfall ID:** ${cardData.id || 'N/A'}
- **Scryfall URI:** ${cardData.scryfall_uri || 'N/A'}
` : `**Card Name:** ${cardName}`;

        const title = `Card Issue: ${cardName} in search "${query}"`;
        const body = `**Search Query:** "${query}"

### 🔗 Reproduction URL
**Click to reproduce:** ${reproductionUrl}
${scryfallInfo}

${cardDetails}

**Issue Description:**
<!-- Please describe what's wrong with this card appearing in the search results -->

**Expected Behavior:**
<!-- What should happen instead? -->

**Additional Context:**
<!-- Any other relevant information -->

---
*Auto-generated bug report from MTG NLP Search*
*Search performed at: ${new Date().toISOString()}*`;

        this.openGitHubIssue(title, body);
    }

    // Commander Modal Methods
    showCommanderModal() {
        // Load commanders if not cached
        this.loadCommanderCache();
        
        // Clear any previous input
        const modalInput = document.getElementById('commanderModalInput');
        const previewDiv = document.getElementById('selectedCommanderPreview');
        const previewImage = document.getElementById('previewCommanderImage');
        const setBtn = document.getElementById('setCommanderBtn');
        
        modalInput.value = '';
        previewDiv.style.display = 'none';
        previewImage.style.display = 'none';
        setBtn.disabled = true;
        
        // Show modal
        const modal = document.getElementById('commanderModal');
        modal.style.display = 'block';
        
        // Focus on input
        setTimeout(() => modalInput.focus(), 100);
    }

    cancelCommanderSelection() {
        // Hide modal
        const modal = document.getElementById('commanderModal');
        modal.style.display = 'none';
        
        // Reset format selector to 'standard' as requested
        this.formatSelect.value = 'standard';
        this.currentFormat = 'standard';
        
        // Clear any commander selection
        this.clearCommander();
        
        // Perform search with new format
        if (this.currentQuery) {
            this.performSearch(1);
        }
    }

    setCommander() {
        const modalInput = document.getElementById('commanderModalInput');
        const commanderName = modalInput.value.trim();
        
        if (!commanderName) {
            return;
        }
        
        // Find commander in cache
        const commander = this.commanderCache?.find(c => 
            c.name.toLowerCase() === commanderName.toLowerCase()
        );
        
        if (!commander) {
            // If not found in cache, still allow it (user might know a commander not in our list)
            // We'll let the backend handle validation
            this.selectedCommander = {
                name: commanderName,
                colors: 'WUBRG' // Default to all colors if unknown
            };
        } else {
            this.selectedCommander = commander;
        }
        
        // Set format to commander
        this.currentFormat = 'commander';
        this.formatSelect.value = 'commander';
        
        // Update commander status display
        this.updateCommanderStatusDisplay();
        
        // Hide modal
        const modal = document.getElementById('commanderModal');
        modal.style.display = 'none';
        
        // Perform search with commander context
        if (this.currentQuery) {
            this.performSearch(1);
        }
        
        console.log(`🎯 Commander set: ${this.selectedCommander.name} (${this.selectedCommander.colors})`);
    }

    handleCommanderModalInput(event) {
        const query = event.target.value.toLowerCase().trim();
        const previewDiv = document.getElementById('selectedCommanderPreview');
        const previewImage = document.getElementById('previewCommanderImage');
        const setBtn = document.getElementById('setCommanderBtn');
        
        if (query.length < 2) {
            this.hideCommanderModalSuggestions();
            previewDiv.style.display = 'none';
            previewImage.style.display = 'none';
            setBtn.disabled = true;
            return;
        }

        // Find exact match first
        const exactMatch = this.commanderCache?.find(commander => 
            commander.name.toLowerCase() === query
        );
        
        if (exactMatch) {
            // Show preview for exact match
            document.getElementById('previewCommanderName').textContent = exactMatch.name;
            document.getElementById('previewCommanderColors').textContent = exactMatch.colors;
            previewDiv.style.display = 'block';
            setBtn.disabled = false;
        } else {
            // Show suggestions for partial matches
            const suggestions = this.commanderCache?.filter(commander => 
                commander.name.toLowerCase().includes(query)
            ).slice(0, 8) || [];
            
            this.showCommanderModalSuggestions(suggestions);
            
            // Enable set button if there's any text (allows custom commanders)
            setBtn.disabled = query.length === 0;
            previewDiv.style.display = 'none';
        }
    }

    showCommanderModalSuggestions(suggestions = []) {
        const suggestionsDiv = document.getElementById('commanderModalSuggestions');
        
        if (suggestions.length === 0) {
            suggestionsDiv.style.display = 'none';
            return;
        }

        suggestionsDiv.innerHTML = suggestions.map(commander => `
            <div class="commander-suggestion" onclick="mtgSearch.selectCommanderFromModal('${commander.name}', '${commander.colors}')">
                <span class="name">${commander.name}</span>
                <span class="colors">${commander.colors}</span>
            </div>
        `).join('');
        
        suggestionsDiv.style.display = 'block';
    }

    hideCommanderModalSuggestions() {
        const suggestionsDiv = document.getElementById('commanderModalSuggestions');
        if (suggestionsDiv) {
            suggestionsDiv.style.display = 'none';
        }
    }

    selectCommanderFromModal(name, colors) {
        const modalInput = document.getElementById('commanderModalInput');
        const previewDiv = document.getElementById('selectedCommanderPreview');
        const setBtn = document.getElementById('setCommanderBtn');
        
        // Set input value
        modalInput.value = name;
        
        // Fetch and display commander card image
        this.loadCommanderImage(name);
        
        previewDiv.style.display = 'block';
        
        // Enable set button
        setBtn.disabled = false;
        
        // Hide suggestions
        this.hideCommanderModalSuggestions();
    }

    async loadCommanderImage(commanderName) {
        const imageElement = document.getElementById('previewCommanderImage');
        
        // Show loading state
        imageElement.style.display = 'none';
        
        try {
            // Use Scryfall API to get commander card image
            const response = await fetch(`https://api.scryfall.com/cards/named?exact=${encodeURIComponent(commanderName)}`);
            
            if (response.ok) {
                const cardData = await response.json();
                
                // Use the normal (larger) image for the preview
                if (cardData.image_uris && cardData.image_uris.normal) {
                    imageElement.src = cardData.image_uris.normal;
                    imageElement.alt = `${commanderName} card`;
                    imageElement.style.display = 'block';
                } else if (cardData.card_faces && cardData.card_faces[0].image_uris) {
                    // Handle double-faced cards
                    imageElement.src = cardData.card_faces[0].image_uris.normal;
                    imageElement.alt = `${commanderName} card`;
                    imageElement.style.display = 'block';
                } else {
                    // No image available
                    console.warn(`No image available for commander: ${commanderName}`);
                    imageElement.style.display = 'none';
                }
            } else {
                console.warn(`Could not fetch image for commander: ${commanderName}`);
                imageElement.style.display = 'none';
            }
        } catch (error) {
            console.error(`Error loading commander image for ${commanderName}:`, error);
            imageElement.style.display = 'none';
        }
    }

    updateCommanderStatusDisplay() {
        const statusDiv = document.getElementById('commanderStatus');
        const statusName = document.getElementById('commanderStatusName');
        
        console.log('🔍 updateCommanderStatusDisplay called:', {
            selectedCommander: this.selectedCommander,
            currentFormat: this.currentFormat,
            shouldShow: this.selectedCommander && this.currentFormat === 'commander'
        });
        
        if (this.selectedCommander && this.currentFormat === 'commander') {
            statusName.textContent = this.selectedCommander.name;
            statusDiv.style.display = 'block';
            console.log('✅ Showing commander status:', this.selectedCommander.name);
            
            // Add event listener to the clear button when status is shown
            const clearBtn = statusDiv.querySelector('.clear-commander-text');
            if (clearBtn) {
                // Remove any existing listener first
                clearBtn.onclick = null;
                // Add new listener
                clearBtn.onclick = () => {
                    console.log('🎯 Clear commander X clicked directly');
                    this.clearCommander();
                };
            }
        } else {
            statusDiv.style.display = 'none';
            console.log('❌ Hiding commander status');
        }
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.mtgSearch = new MTGSearch();
});
