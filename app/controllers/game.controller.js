angular.module('gameOfWarApp')
  .controller('GameController', ['$http', function($http) {
    const vm = this;

    vm.deckId = null;
    vm.computerScore = 0;
    vm.myScore = 0;
    vm.remaining = '';
    vm.header = 'Game of War';
    vm.images = ['', ''];
    vm.drawDisabled = true;

    vm.newGame = function() {
      $http.get('https://apis.scrimba.com/deckofcards/api/deck/new/shuffle/')
        .then(function(res) {
          vm.remaining = 'Remaining cards: ' + res.data.remaining;
          vm.deckId = res.data.deck_id;
          vm.computerScore = 0;
          vm.myScore = 0;
          vm.images = ['', ''];
          vm.header = 'Game of War';
          vm.drawDisabled = false;
        }, function(err) {
          console.error('Failed to start new game', err);
        });
    };

    vm.drawCards = function() {
      if (!vm.deckId) return;
      $http.get('https://apis.scrimba.com/deckofcards/api/deck/' + vm.deckId + '/draw/?count=2')
        .then(function(res) {
          const data = res.data;
          vm.remaining = 'Remaining cards: ' + data.remaining;
          vm.images[0] = data.cards[0].image;
          vm.images[1] = data.cards[1].image;
          const winnerText = determineCardWinner(data.cards[0], data.cards[1]);
          vm.header = winnerText;

          if (data.remaining === 0) {
            vm.drawDisabled = true;
            if (vm.computerScore > vm.myScore) {
              vm.header = 'The computer won the game!';
            } else if (vm.myScore > vm.computerScore) {
              vm.header = 'You won the game!';
            } else {
              vm.header = "It's a tie game!";
            }
          }
        }, function(err) {
          console.error('Failed to draw cards', err);
        });
    };

    function determineCardWinner(card1, card2) {
      const valueOptions = ["2","3","4","5","6","7","8","9","10","JACK","QUEEN","KING","ACE"];
      const card1ValueIndex = valueOptions.indexOf(card1.value);
      const card2ValueIndex = valueOptions.indexOf(card2.value);

      if (card1ValueIndex > card2ValueIndex) {
        vm.computerScore++;
        return 'Computer wins!';
      } else if (card1ValueIndex < card2ValueIndex) {
        vm.myScore++;
        return 'You win!';
      } else {
        return 'Tie!';
      }
    }
  }]);
