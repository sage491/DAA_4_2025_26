#include <bits/stdc++.h>
using namespace std;

int main() {
    int n;
    cin >> n;

    vector<char> attendance(n);
    for(int i = 0; i < n; i++) {
        cin >> attendance[i];
    }

    unordered_map<int, int> mp;
    mp[0] = -1;   
    int prefix_sum = 0;
    int max_len = 0;

    for(int i = 0; i < n; i++) {
        if(attendance[i] == 'P')
            prefix_sum += 1;
        else
            prefix_sum -= 1;

        if(mp.find(prefix_sum) != mp.end()) {
            max_len = max(max_len, i - mp[prefix_sum]);
        } else {
            mp[prefix_sum] = i;
        }
    }

    cout << max_len << endl;
    return 0;
}
