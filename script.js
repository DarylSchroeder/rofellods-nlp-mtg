class MTGSearch {
    constructor() {
        this.apiUrl = 'https://mtg-nlp-search.onrender.com/search';
        this.currentQuery = '';
        this.currentPage = 1;
        this.perPage = 20;
        this.viewMode = 'tiles'; // 'tiles' or 'text'
        this.lastScryfallCall = null; // Cache latest Scryfall API call for bug reports
        
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
        this.bindEvents();
        
        // If we have a query from URL, perform search automatically
        if (this.currentQuery) {
            this.performSearch();
        }
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
        
        if (this.viewMode !== 'tiles') {
            params.set('view', this.viewMode);
        }
        
        if (this.currentPage > 1) {
            params.set('page', this.currentPage.toString());
        }
        
        if (this.perPage !== 20) {
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

    initializeElements() {
        this.searchInput = document.getElementById('searchInput');
        this.searchButton = document.getElementById('searchButton');
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
            }
        });

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
        });
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
            const params = new URLSearchParams({
                prompt: query,
                page: page.toString(),
                per_page: this.perPage.toString()
            });

            const response = await fetch(`${this.apiUrl}?${params}`);
            const data = await response.json();
            
            // Cache the API call info for bug reports
            this.lastScryfallCall = {
                timestamp: new Date().toISOString(),
                searchQuery: query,
                apiUrl: `${this.apiUrl}?${params}`,
                responseData: data,
                scryfallQuery: data.scryfall_query || null,
                parsedFilters: data.parsed_filters || null
            };
            
            // Store in localStorage for persistence across page refreshes
            try {
                localStorage.setItem('lastScryfallCall', JSON.stringify(this.lastScryfallCall));
            } catch (e) {
                console.warn('Could not save Scryfall call to localStorage:', e);
            }

            this.hideLoading();

            if (data.error) {
                this.showError(data.error);
                return;
            }

            if (!data.results || data.results.length === 0) {
                this.showNoResults();
                return;
            }

            this.displayResults(data.results, data.pagination, query);
        } catch (error) {
            console.error('Search error:', error);
            this.hideLoading();
            this.showError('Failed to search. Please try again.');
        }
    }

    displayResults(cards, pagination, query) {
        const { page, total_results, total_pages } = pagination;
        
        this.resultsCount.innerHTML = `
            <div class="results-info">
                <span>About ${total_results} results for "${query}" (Page ${page} of ${total_pages})</span>
                <button class="report-search-btn" onclick="mtgSearch.reportSearchIssue('${query}', ${page})">
                    🐛 Report Search Issue
                </button>
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

        // Add pagination to results
        this.results.appendChild(paginationDiv);
    }

    createPageButton(text, pageNum) {
        const button = document.createElement('button');
        button.textContent = text;
        button.className = 'pagination-btn';
        button.addEventListener('click', () => {
            this.performSearch(pageNum);
            window.scrollTo({ top: 0, behavior: 'smooth' });
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
                'azorius:only removal',
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
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.mtgSearch = new MTGSearch();
});
