class MTGSearch {
    constructor() {
        this.apiUrl = 'https://mtg-nlp-search.onrender.com/search';
        this.currentQuery = '';
        this.currentPage = 1;
        this.perPage = 20;
        this.initializeElements();
        this.bindEvents();
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

        // Focus on search input when page loads
        this.searchInput.focus();
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
            About ${total_results} results for "${query}" (Page ${page} of ${total_pages})
            <button class="report-search-btn" onclick="mtgSearch.reportSearchIssue('${query}', ${page})">
                🐛 Report Search Issue
            </button>
        `;
        this.cardResults.innerHTML = '';

        cards.forEach(card => {
            const cardElement = this.createCardElement(card);
            this.cardResults.appendChild(cardElement);
        });

        // Add pagination controls
        this.addPaginationControls(pagination);

        this.showResults();
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

    createCardElement(card) {
        const cardRow = document.createElement('div');
        cardRow.className = 'card-row';

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
        const oracleText = card.oracle_text ? this.truncateText(card.oracle_text, 150) : '';

        cardRow.innerHTML = `
            <div class="card-image">
                ${imageUrl ? `<img src="${imageUrl}" alt="${card.name}" loading="lazy">` : '<div class="no-image">No Image</div>'}
            </div>
            <div class="card-content">
                <div class="card-header">
                    <a href="${card.scryfall_uri}" target="_blank" class="card-name">${card.name}</a>
                    <div class="card-type">${card.type_line}</div>
                </div>
                ${oracleText ? `<div class="card-text">${oracleText}</div>` : ''}
                <div class="card-details">
                    ${manaCost ? `<div class="mana-cost">${manaCost}</div>` : ''}
                    <div class="card-stats">
                        ${card.cmc !== undefined ? `<span>CMC: ${card.cmc}</span>` : ''}
                        ${powerToughness ? `<span>P/T: ${powerToughness}</span>` : ''}
                        ${card.rarity ? `<span>${this.capitalizeFirst(card.rarity)}</span>` : ''}
                        <span class="price">${price}</span>
                    </div>
                    <div class="card-actions">
                        ${tcgLink !== '#' ? `<a href="${tcgLink}" target="_blank" class="tcg-link">Buy on TCGPlayer</a>` : ''}
                        <button class="report-card-btn" onclick="mtgSearch.reportCardIssue('${card.name.replace(/'/g, "\\'")}', '${card.id}')">
                            🐛 Report Issue
                        </button>
                    </div>
                </div>
            </div>
        `;

        return cardRow;
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
        return `## Search Issue Report

**Search Query:** \`${query}\`
**Page:** ${page}
**Timestamp:** ${timestamp}
**URL:** ${window.location.href}

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
        return `## Card Issue Report

**Card Name:** ${cardName}
**Card ID:** \`${cardId}\`
**Search Query:** \`${this.currentQuery}\`
**Page:** ${this.currentPage}
**Timestamp:** ${timestamp}
**URL:** ${window.location.href}

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
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.mtgSearch = new MTGSearch();
});
