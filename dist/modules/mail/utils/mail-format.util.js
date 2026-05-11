"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatCurrency = formatCurrency;
exports.formatDateTime = formatDateTime;
function formatCurrency(amount) {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return `Rs. ${new Intl.NumberFormat('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(num)}`;
}
function formatDateTime(date) {
    const formatted = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Kathmandu',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
    }).format(date);
    return `${formatted} NPT`;
}
//# sourceMappingURL=mail-format.util.js.map