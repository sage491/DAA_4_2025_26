from collections import deque

class Solution:
    def maxOfSubarrays(self, arr, k):
        n = len(arr)
        dq = deque()   
        result = []

        for i in range(n):
            while dq and arr[dq[-1]] <= arr[i]:
                dq.pop()

            dq.append(i)
            if dq[0] <= i - k:
                dq.popleft()
            if i >= k - 1:
                result.append(arr[dq[0]])

        return result