class MTGSearch {
    constructor() {
        this.apiUrl = 'https://mtg-nlp-search.onrender.com/search';
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

    async performSearch() {
        const query = this.searchInput.value.trim();
        if (!query) return;

        this.showLoading();
        this.hideAllSections();

        try {
            const response = await fetch(`${this.apiUrl}?${new URLSearchParams({ prompt: query })}`);
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

            this.displayResults(data.results, query);
        } catch (error) {
            console.error('Search error:', error);
            this.hideLoading();
            this.showError('Failed to search. Please try again.');
        }
    }

    displayResults(cards, query) {
        this.resultsCount.textContent = `About ${cards.length} results for "${query}"`;
        this.cardResults.innerHTML = '';

        cards.forEach(card => {
            const cardElement = this.createCardElement(card);
            this.cardResults.appendChild(cardElement);
        });

        this.showResults();
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
                    ${tcgLink !== '#' ? `<a href="${tcgLink}" target="_blank" class="tcg-link">Buy on TCGPlayer</a>` : ''}
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
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new MTGSearch();
});
