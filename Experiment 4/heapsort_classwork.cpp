#include <bits/stdc++.h>
using namespace std;

#define MAX 100

int heap[MAX];
int heapSize = 0;

void heapifyDown(int i) {
    int smallest = i;
    int left = 2*i + 1;
    int right = 2*i + 2;

    if(left < heapSize && heap[left] < heap[smallest])
        smallest = left;

    if(right < heapSize && heap[right] < heap[smallest])
        smallest = right;

    if(smallest != i) {
        swap(heap[i], heap[smallest]);
        heapifyDown(smallest);
    }
}

void heapifyUp(int i) {
    while(i > 0 && heap[(i-1)/2] > heap[i]) {
        swap(heap[i], heap[(i-1)/2]);
        i = (i-1)/2;
    }
}

void insert(int val) {
    if(heapSize == MAX) {
        cout << "overflow\n";
        return;
    }

    heap[heapSize++] = val;
    heapifyUp(heapSize - 1);
}

void deleteRoot() {
    if(heapSize == 0) {
        cout << "no element\n";
        return;
    }

    heap[0] = heap[heapSize - 1];
    heapSize--;
    heapifyDown(0);
}

int search(int val) {
    for(int i = 0; i < heapSize; i++)
        if(heap[i] == val)
            return i;
    return -1;
}

void deleteValue(int val) {
    int idx = search(val);

    if(idx == -1) {
        cout << "element not found\n";
        return;
    }

    heap[idx] = heap[heapSize - 1];
    heapSize--;

    heapifyDown(idx);
    heapifyUp(idx);
}

int main() {
    insert(5);
    insert(3);
    insert(8);
    insert(1);
    insert(6);

    deleteValue(3);
    deleteRoot();

    for(int i = 0; i < heapSize; i++)
        cout << heap[i] << " ";
}
