import { findJavaDefinitionInText } from '../packages/plugins/editor/src/utils/java-definition-helper.ts';

const javaSampleCode = `package com.example.service;

import java.util.List;
import java.util.Optional;

public class OrderService extends BaseService implements IOrderService {
    private final OrderRepository orderRepository;
    public static final int MAX_RETRY = 3;

    public OrderService(OrderRepository orderRepository) {
        this.orderRepository = orderRepository;
    }

    public OrderDto processOrder(String orderId, double amount) throws Exception {
        validateOrder(orderId, amount);
        return calculateTotal(orderId);
    }

    private void validateOrder(String orderId, double amount) {
        if (amount <= 0) {
            throw new IllegalArgumentException("Invalid amount");
        }
    }

    public static <T> List<T> filterItems(List<T> items, boolean activeOnly) {
        return items;
    }

    private OrderDto calculateTotal(String orderId) {
        // Calling validateOrder again here
        validateOrder(orderId, 100.0);
        return new OrderDto(orderId);
    }

    protected abstract void onOrderCancelled(String orderId);

    default boolean isEligibleForDiscount(User user) {
        return false;
    }
}
`;

console.log('--- Testing Java Definition Finder ---');

// Test 1: Standard method definition
const defValidate = findJavaDefinitionInText(javaSampleCode, 'validateOrder');
console.log('Test 1 (validateOrder line):', defValidate?.line);
if (defValidate?.line !== 19) {
  console.error(`Expected validateOrder at line 19, got ${defValidate?.line}`);
  process.exit(1);
}

// Test 2: Method with generic return type
const defFilter = findJavaDefinitionInText(javaSampleCode, 'filterItems');
console.log('Test 2 (filterItems line):', defFilter?.line);
if (defFilter?.line !== 25) {
  console.error(`Expected filterItems at line 25, got ${defFilter?.line}`);
  process.exit(1);
}

// Test 3: Method returning object and throwing exception
const defProcess = findJavaDefinitionInText(javaSampleCode, 'processOrder');
console.log('Test 3 (processOrder line):', defProcess?.line);
if (defProcess?.line !== 14) {
  console.error(`Expected processOrder at line 14, got ${defProcess?.line}`);
  process.exit(1);
}

// Test 4: Constructor
const defConstructor = findJavaDefinitionInText(javaSampleCode, 'OrderService');
console.log('Test 4 (OrderService constructor line):', defConstructor?.line);
if (defConstructor?.line !== 10) {
  console.error(`Expected OrderService constructor at line 10, got ${defConstructor?.line}`);
  process.exit(1);
}

// Test 5: Abstract method
const defAbstract = findJavaDefinitionInText(javaSampleCode, 'onOrderCancelled');
console.log('Test 5 (onOrderCancelled line):', defAbstract?.line);
if (defAbstract?.line !== 35) {
  console.error(`Expected onOrderCancelled at line 35, got ${defAbstract?.line}`);
  process.exit(1);
}

// Test 6: Default method
const defDefault = findJavaDefinitionInText(javaSampleCode, 'isEligibleForDiscount');
console.log('Test 6 (isEligibleForDiscount line):', defDefault?.line);
if (defDefault?.line !== 37) {
  console.error(`Expected isEligibleForDiscount at line 37, got ${defDefault?.line}`);
  process.exit(1);
}

console.log('\n>>> ALL JAVA DEFINITION TESTS PASSED!');
