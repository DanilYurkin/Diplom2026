// cart.js

// === Функции для работы с корзиной через API ===

async function getCart() {
    try {
        const response = await fetch('/api/cart');
        if (!response.ok) throw new Error('Ошибка при получении корзины');
        return await response.json();
    } catch (error) {
        console.error('Ошибка:', error);
        return { btc: {}, btb: {} };
    }
}

async function removeCartItem(category, productId) {
    try {
        const response = await fetch('/api/cart/remove', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ category: category, product_id: productId })
        });
        if (response.ok) {
            location.reload(); // перезагружаем страницу для обновления корзины
        } else {
            alert('Ошибка при удалении товара');
        }
    } catch (error) {
        console.error('Ошибка:', error);
        alert('Не удалось удалить товар');
    }
}

async function updateCartItem(category, productId, quantity) {
    if (quantity < 1) {
        removeCartItem(category, productId);
        return;
    }
    try {
        const response = await fetch('/api/cart/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ category: category, product_id: productId, quantity: quantity })
        });
        if (response.ok) {
            location.reload();
        } else {
            alert('Ошибка при обновлении количества');
        }
    } catch (error) {
        console.error('Ошибка:', error);
        alert('Не удалось обновить количество');
    }
}

// === Оформление заказа и оплата через СБП ===

function showPaymentModal(orderId, amount) {
    const modal = document.getElementById('payment-modal');
    if (!modal) return;

    // Отображаем текстовые данные
    document.getElementById('sbp-amount').textContent = `${amount.toFixed(2)} RUB`;
    document.getElementById('sbp-order-id').textContent = orderId;

    // Генерируем QR (обратите внимание на параметр ?t= для обхода кэша)
    const qrContainer = document.getElementById('qr-container');
    if (qrContainer) {
        qrContainer.innerHTML = `
            <img src="/generate-qr/${orderId}?t=${Date.now()}"
                 alt="QR-код СБП"
                 class="qr-code"
                 onerror="handleQrError(this)">
        `;
    }

    modal.style.display = 'block';
}

function handleQrError(imgElement) {
    console.error('Ошибка загрузки QR-кода');
    const container = imgElement.parentNode;
    if (container) {
        container.innerHTML = '<p class="qr-error">Не удалось загрузить QR-код. Пожалуйста, обновите страницу.</p>';
    }
    imgElement.style.display = 'none';
}

function closePaymentModal() {
    const modal = document.getElementById('payment-modal');
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
    }
}

async function checkPaymentStatus(orderId) {
    try {
        const response = await fetch(`/api/orders/status/${orderId}`);
        const result = await response.json();

        if (!response.ok) throw new Error(result.message || 'Ошибка проверки статуса');

        if (result.payment_status === 'paid') {
            alert('Оплата подтверждена! Спасибо за заказ!');
            closePaymentModal();
            // Очищаем корзину после успешной оплаты
            await fetch('/api/cart/clear', { method: 'POST' });
            window.location.href = '/';
        } else {
            alert('Оплата еще не получена. Пожалуйста, попробуйте позже.');
        }
    } catch (error) {
        console.error('Ошибка проверки статуса:', error);
        alert(`Ошибка: ${error.message}`);
    }
}

async function checkout() {
    const cart = await getCart();

    if (Object.keys(cart.btc).length === 0 && Object.keys(cart.btb).length === 0) {
        alert('Ваша корзина пуста!');
        return;
    }

    if (!confirm('Вы уверены, что хотите оформить заказ?')) return;

    try {
        const orderItems = [];
        let total = 0;

        for (const [category, products] of Object.entries(cart)) {
            for (const [productId, item] of Object.entries(products)) {
                orderItems.push({
                    product_id: productId,
                    name: item.product_info.name,
                    quantity: item.quantity,
                    price: item.product_info.price,
                    sum: item.product_info.price * item.quantity,
                    category: category
                });
                total += item.product_info.price * item.quantity;
            }
        }

        if (total <= 0) throw new Error('Сумма заказа должна быть больше 0');

        const orderData = {
            items: orderItems,
            total: total,
            timestamp: new Date().toISOString(),
            status: 'pending'
        };

        const orderResponse = await fetch('/api/orders/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(orderData)
        });

        if (!orderResponse.ok) {
            const errorData = await orderResponse.json();
            throw new Error(errorData.message || 'Ошибка при оформлении заказа');
        }

        const orderResult = await orderResponse.json();

        if (orderResult.status !== 'success') {
            throw new Error('Не удалось создать заказ');
        }

        // Показываем модальное окно с QR-кодом и реквизитами
        showPaymentModal(orderResult.order_id, orderResult.amount);

        // Очищаем корзину (локально и на сервере)
        await fetch('/api/cart/clear', { method: 'POST' });

        // Обновляем счётчик корзины в шапке (если есть элемент)
        const cartCounter = document.getElementById('cart-count');
        if (cartCounter) cartCounter.textContent = '0';

    } catch (error) {
        console.error('Ошибка оформления заказа:', error);
        alert(`Ошибка: ${error.message}`);
    }
}

// === Инициализация при загрузке страницы ===

document.addEventListener('DOMContentLoaded', () => {
    const checkoutBtn = document.querySelector('.btn-checkout');
    if (checkoutBtn) {
        checkoutBtn.addEventListener('click', checkout);
    }

    // Модальное окно – закрытие по крестику или клику вне окна
    const modal = document.getElementById('payment-modal');
    if (modal) {
        const closeBtn = modal.querySelector('.close');
        if (closeBtn) {
            closeBtn.addEventListener('click', closePaymentModal);
        }
        window.addEventListener('click', (e) => {
            if (e.target === modal) closePaymentModal();
        });
    }

    // Проверяем, есть ли order_id в URL (возврат после оплаты)
    const urlParams = new URLSearchParams(window.location.search);
    const orderId = urlParams.get('order_id');
    if (orderId) {
        checkPaymentStatus(orderId);
    }
});