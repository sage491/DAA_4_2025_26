import heapq

def cutoff_scores(scores, k):
    heap = []

    for score in scores:
        heapq.heappush(heap, score)

        if len(heap) > k:
            heapq.heappop(heap)

        if len(heap) < k:
            print(-1)
        else:
            print(heap[0])


k = 3
scores = [10, 20, 5, 15, 25, 8]

cutoff_scores(scores, k)