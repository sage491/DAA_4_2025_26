import heapq

def prim(n, adj, start=0):
    visited = [False] * n
    heap = [(0, start)]
    total = 0

    while heap:
        w, u = heapq.heappop(heap)
        if visited[u]:
            continue
        visited[u] = True
        total += w
        for v, wt in adj[u]:
            if not visited[v]:
                heapq.heappush(heap, (wt, v))
    return total