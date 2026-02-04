MAX = 100

heap = [0] * MAX
heap_size = 0


def heapify_down(i):
    global heap_size

    smallest = i
    left = 2 * i + 1
    right = 2 * i + 2

    if left < heap_size and heap[left] < heap[smallest]:
        smallest = left

    if right < heap_size and heap[right] < heap[smallest]:
        smallest = right

    if smallest != i:
        heap[i], heap[smallest] = heap[smallest], heap[i]
        heapify_down(smallest)


def heapify_up(i):
    while i > 0 and heap[(i - 1) // 2] > heap[i]:
        heap[i], heap[(i - 1) // 2] = heap[(i - 1) // 2], heap[i]
        i = (i - 1) // 2


def insert(val):
    global heap_size

    if heap_size == MAX:
        print("overflow")
        return

    heap[heap_size] = val
    heap_size += 1
    heapify_up(heap_size - 1)


def delete_root():
    global heap_size

    if heap_size == 0:
        print("no element")
        return

    heap[0] = heap[heap_size - 1]
    heap_size -= 1
    heapify_down(0)


def search(val):
    for i in range(heap_size):
        if heap[i] == val:
            return i
    return -1


def delete_value(val):
    global heap_size

    idx = search(val)

    if idx == -1:
        print("element not found")
        return

    heap[idx] = heap[heap_size - 1]
    heap_size -= 1

    heapify_down(idx)
    heapify_up(idx)


insert(5)
insert(3)
insert(8)
insert(1)
insert(6)

delete_value(3)
delete_root()

for i in range(heap_size):
    print(heap[i], end=" ")
