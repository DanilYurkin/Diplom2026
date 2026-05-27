document.addEventListener('DOMContentLoaded', async () => {
    await fetchProducts();
    updateCartCounter();
});

async function fetchProducts() {
    try {
        const response = await fetch('/api/products');
        if (!response.ok) throw new Error('Ошибка при загрузке товаров');
        const products = await response.json();

        const productsContainer = document.getElementById('Ozon_products');
        if (!productsContainer) return;

        productsContainer.innerHTML = '';

        const currentPath = window.location.pathname;
        const category = currentPath.includes('btc') ? 'btc' : 'btb';

        // Ссылка на ваш магазин Ozon (для BTC)
        const OZON_SHOP_URL = 'https://www.ozon.ru/seller/2403648/';   // замените при необходимости

        products.forEach(product => {
            const productDiv = document.createElement('div');
            productDiv.className = 'product';

            let priceHtml = '';
            let actionHtml = '';

            if (category === 'btc') {
                // BTC: цена со скидкой (минимальная) и цена без скидки (максимальная)
                const discountedPrice = product.ozon_price;   // текущая цена Ozon (со скидкой)
                const originalPrice = product.old_price;      // старая цена (без скидки)

                priceHtml = `
                    <span class="btc-discount-price">${discountedPrice} ${product.currency_code}</span>
                    ${originalPrice && originalPrice > discountedPrice ? `<span class="btc-original-price">${originalPrice} ${product.currency_code}</span>` : ''}
                `;
                actionHtml = `
                    <div class="purchase-form">
                        <a href="${OZON_SHOP_URL}" target="_blank" rel="noopener noreferrer" class="btn-buy btn-btc-shop">Перейти в магазин на Ozon →</a>
                    </div>
                `;
            } else { // BTB
                // BTB: показываем BTB-цену (если есть), и всегда минимальную цену Ozon
                const ozonMinPrice = product.ozon_price;
                if (product.btb_price && product.btb_price > 0) {
                    priceHtml = `
                        <span class="btb-price">${product.btb_price} ${product.currency_code}</span>
                        <span class="price-notice">(Минимальная цена Ozon: ${ozonMinPrice})</span>
                    `;
                    actionHtml = `
                        <div class="purchase-form">
                            <button onclick="decrementQuantity(${product.product_id})" class="quantity-btn">-</button>
                            <input type="number" id="quantity-${product.product_id}" min="0" value="0" class="quantity-input">
                            <button onclick="incrementQuantity(${product.product_id})" class="quantity-btn">+</button>
                            <button onclick="addToCart(${product.product_id}, '${category}')" class="btn-buy">Добавить</button>
                        </div>
                    `;
                } else {
                    priceHtml = `
                        <span class="error-price">Цена пока не установлена</span>
                        <span class="price-notice">(Минимальная цена Ozon: ${ozonMinPrice})</span>
                    `;
                    actionHtml = ''; // без кнопки добавления
                }
            }

            productDiv.innerHTML = `
                <img src="${product.images.length ? product.images[0] : '/static/no_image.png'}" alt="Фото товара" class="product-img">
                <h2><a href="/product/${product.product_id}">${product.name}</a></h2>
                <div class="price-block">
                    ${priceHtml}
                </div>
                ${actionHtml}
                ${category === 'btc' ? `
                    <div class="product-stocks">
                        <p><strong>Остатки на складах:</strong></p>
                        ${product.stocks.map(stock => `<p>${stock.split(':')[0]}: ${stock.split(':')[1]}</p>`).join('')}
                    </div>
                ` : ''}
            `;
            productsContainer.appendChild(productDiv);
        });
    } catch (error) {
        console.error(error);
        alert('Не удалось загрузить товары');
    }
}
function incrementQuantity(productId) {
    const input = document.getElementById(`quantity-${productId}`);
    input.value = parseInt(input.value) + 1;
}

function decrementQuantity(productId) {
    const input = document.getElementById(`quantity-${productId}`);
    const newValue = parseInt(input.value) - 1;
    input.value = newValue >= 0 ? newValue : 0;
}

async function addToCart(productId, category) {
    const quantityInput = document.getElementById(`quantity-${productId}`);
    const quantity = parseInt(quantityInput.value);

    if (quantity <= 0) {
        alert('Пожалуйста, укажите количество больше 0');
        return;
    }

    try {
        const response = await fetch('/api/cart/add', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                product_id: productId,
                quantity: quantity,
                category: category
            })
        });

        if (response.status === 401) {
            alert('Для заказа BTB необходимо войти в аккаунт.');
            window.location.href = '/login';
            return;
        }

        const result = await response.json();

        if (!response.ok || result.status !== 'success') {
            throw new Error(result.message || 'Ошибка при добавлении');
        }

        alert(`Товар добавлен в корзину (${quantity} шт.)`);
        updateCartCounter();
    } catch (error) {
        console.error(error);
        alert('Не удалось добавить товар в корзину');
    }
}

async function updateCartCounter() {
    try {
        const response = await fetch('/api/cart');
        const cart = await response.json();

        const totalCount = Object.values(cart).reduce((total, category) => {
            return total + Object.values(category).reduce((sum, item) => sum + item.quantity, 0);
        }, 0);

        const counter = document.getElementById('cart-count');
        if (counter) counter.textContent = totalCount;
    } catch (error) {
        console.error('Ошибка при обновлении счетчика корзины:', error);
    }
}

// Обновление цены
async function updatePrice(productId) {
    const newPrice = document.querySelector(`.price-input[data-product-id="${productId}"]`).value;

    try {
        const response = await fetch(`/api/btb/products/${productId}/price`, {
            method: 'PUT',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ price: newPrice })
        });

        if (!response.ok) throw new Error('Ошибка обновления');
        alert('Цена обновлена!');
    } catch (e) {
        alert(e.message);
    }
}

// Сброс цены
async function resetPrice(productId) {
    try {
        const response = await fetch(`/api/btb/products/${productId}/price`, {
            method: 'DELETE'
        });

        if (!response.ok) throw new Error('Ошибка сброса');
        alert('Цена восстановлена!');
        location.reload();
    } catch (e) {
        alert(e.message);
    }
}

document.addEventListener('DOMContentLoaded', () => {
  const btn = document.querySelector('.mobile-menu-btn');
  const nav = document.querySelector('.main-nav');

  if (btn && nav) {
    btn.addEventListener('click', () => {
      const expanded = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', String(!expanded));
      nav.classList.toggle('open');
    });
  }
});