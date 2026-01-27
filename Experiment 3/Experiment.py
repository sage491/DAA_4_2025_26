n = int(input())
attendance = input().split()

prefix_sum = 0
max_len = 0

mp = {}
mp[0] = -1   

for i in range(n):
    if attendance[i] == 'P':
        prefix_sum += 1
    else:  
        prefix_sum -= 1

    if prefix_sum in mp:
        max_len = max(max_len, i - mp[prefix_sum])
    else:
        mp[prefix_sum] = i

print(max_len)
